import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { proposalSchema, acceptProposalSchema } from '../validators';
import { string } from 'zod';

const router = Router();

// POST /api/projects/:projectId/proposals — Freelancer only
router.post('/projects/:projectId/proposals', authenticate, authorize('freelancer'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { projectId } = req.params;

    // Validate request body
    const parsed = proposalSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    // Check project exists
    const project = await prisma.project.findUnique({ where: { id: projectId as string } });
    if (!project) {
      return sendError(res, 'PROJECT_NOT_FOUND', 404);
    }

    // Check freelancer hasn't already submitted a proposal for this project
    const existingProposal = await prisma.proposal.findUnique({
      where: {
        projectId_freelancerId: {
          projectId: projectId as string,
          freelancerId: user.id,
        },
      },
    });
    if (existingProposal) {
      return sendError(res, 'PROPOSAL_ALREADY_EXISTS', 400);
    }

    const { coverLetter, proposedPrice, estimatedDuration } = parsed.data;

    // Create the proposal
    const proposal = await prisma.proposal.create({
      data: {
        projectId: projectId as string,
        freelancerId: user.id,
        coverLetter,
        proposedPrice,
        estimatedDuration,
        status: 'pending',
      },
    });

    return sendSuccess(res, proposal, 201);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// GET /api/projects/:projectId/proposals — Project owner (client) only
router.get('/projects/:projectId/proposals', authenticate, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { projectId } = req.params;

    // Check project exists
    const project = await prisma.project.findUnique({ where: { id: projectId as string } });
    if (!project) {
      return sendError(res, 'PROJECT_NOT_FOUND', 404);
    }

    // Only the project owner can view proposals
    if (project.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    // Get all proposals for this project
    const proposals = await prisma.proposal.findMany({
      where: { projectId : projectId  as string },
    });

    return sendSuccess(res, proposals);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// PUT /api/proposals/:proposalId/accept — Client only (TRANSACTION)
router.put('/proposals/:proposalId/accept', authenticate, authorize('client'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { proposalId } = req.params;

    // Validate milestones in request body
    const parsed = acceptProposalSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    // Find the proposal
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId as string },
      include: { project: true },
    });

    if (!proposal) {
      return sendError(res, 'PROPOSAL_NOT_FOUND', 404);
    }

    // Check proposal is still pending
    if (proposal.status !== 'pending') {
      return sendError(res, 'PROPOSAL_ALREADY_PROCESSED', 400);
    }

    // Verify the client owns this project
    if (proposal.project.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    const { milestones } = parsed.data;

    // ATOMIC TRANSACTION: accept proposal, reject others, create contract + milestones
    const result = await prisma.$transaction(async (tx) => {
      // 1. Accept this proposal
      const acceptedProposal = await tx.proposal.update({
        where: { id: proposalId as string },
        data: { status: 'accepted' },
      });

      // 2. Reject all other proposals for the same project
      await tx.proposal.updateMany({
        where: {
          projectId: proposal.projectId as string,
          id: { not: proposalId as string },
        },
        data: { status: 'rejected' },
      });

      // 3. Update project status to in_progress
      await tx.project.update({
        where: { id: proposal.projectId },
        data: { status: 'in_progress' },
      });

      // 4. Create the contract
      const contract = await tx.contract.create({
        data: {
          projectId: proposal.projectId,
          freelancerId: proposal.freelancerId,
          clientId: user.id,
          totalAmount: proposal.proposedPrice,
          status: 'active',
        },
      });

      // 5. Create milestones with sequential order_index
      const createdMilestones = await Promise.all(
        milestones.map((m, index) =>
          tx.milestone.create({
            data: {
              contractId: contract.id,
              title: m.title,
              description: m.description || null,
              amount: m.amount,
              dueDate: new Date(m.dueDate),
              orderIndex: index,
              status: 'pending',
            },
          })
        )
      );

      return { proposal: acceptedProposal, contract, milestones: createdMilestones };
    });

    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
