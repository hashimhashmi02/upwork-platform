import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// PUT /api/milestones/:milestoneId/submit — Freelancer only
router.put('/:milestoneId/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const milestoneId = req.params.milestoneId as string;

    // Find the milestone first
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    // Get the contract separately to avoid TypeScript include issues
    const contract = await prisma.contract.findUnique({
      where: { id: milestone.contractId },
    });

    if (!contract) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    // Only the contract's freelancer can submit
    if (contract.freelancerId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    // Check if already submitted or approved
    if (milestone.status === 'submitted' || milestone.status === 'approved') {
      return sendError(res, 'MILESTONE_ALREADY_SUBMITTED', 400);
    }

    // Sequential milestone check: if orderIndex > 0, previous must be approved
    if (milestone.orderIndex > 0) {
      const previousMilestone = await prisma.milestone.findFirst({
        where: {
          contractId: milestone.contractId,
          orderIndex: milestone.orderIndex - 1,
        },
      });

      if (!previousMilestone || previousMilestone.status !== 'approved') {
        return sendError(res, 'PREVIOUS_MILESTONE_INCOMPLETE', 400);
      }
    }

    // Update milestone status to submitted
    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'submitted' },
    });

    return sendSuccess(res, updated);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// PUT /api/milestones/:milestoneId/approve — Client only
router.put('/:milestoneId/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const milestoneId = req.params.milestoneId as string;

    // Find the milestone first
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    // Get the contract separately
    const contract = await prisma.contract.findUnique({
      where: { id: milestone.contractId },
    });

    if (!contract) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    // Only the contract's client can approve
    if (contract.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    // Check if already approved
    if (milestone.status === 'approved') {
      return sendError(res, 'MILESTONE_ALREADY_APPROVED', 400);
    }

    // Update milestone status to approved
    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'approved' },
    });

    // Check if ALL milestones in this contract are now approved
    const allMilestones = await prisma.milestone.findMany({
      where: { contractId: milestone.contractId },
    });

    const allApproved = allMilestones.every((m) =>
      m.id === milestoneId ? true : m.status === 'approved'
    );

    // If all approved, complete the contract and project
    if (allApproved) {
      await prisma.contract.update({
        where: { id: milestone.contractId },
        data: { status: 'completed' },
      });

      await prisma.project.update({
        where: { id: contract.projectId },
        data: { status: 'completed' },
      });
    }

    return sendSuccess(res, updated);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
