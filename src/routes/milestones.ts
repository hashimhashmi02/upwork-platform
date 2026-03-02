import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();


router.put('/:milestoneId/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const milestoneId = req.params.milestoneId as string;

    
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    
    const contract = await prisma.contract.findUnique({
      where: { id: milestone.contractId },
    });

    if (!contract) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    
    if (contract.freelancerId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    
    if (milestone.status === 'submitted' || milestone.status === 'approved') {
      return sendError(res, 'MILESTONE_ALREADY_SUBMITTED', 400);
    }

    
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

    
    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'submitted' },
    });

    return sendSuccess(res, updated);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});


router.put('/:milestoneId/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const milestoneId = req.params.milestoneId as string;

    
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    
    const contract = await prisma.contract.findUnique({
      where: { id: milestone.contractId },
    });

    if (!contract) {
      return sendError(res, 'MILESTONE_NOT_FOUND', 404);
    }

    
    if (contract.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    
    if (milestone.status === 'approved') {
      return sendError(res, 'MILESTONE_ALREADY_APPROVED', 400);
    }

    
    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'approved' },
    });

    
    const allMilestones = await prisma.milestone.findMany({
      where: { contractId: milestone.contractId },
    });

    const allApproved = allMilestones.every((m) =>
      m.id === milestoneId ? true : m.status === 'approved'
    );

    
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
