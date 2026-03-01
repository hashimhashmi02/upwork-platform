import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { proposalSchema, acceptProposalSchema } from '../validators';
import { string } from 'zod';

const router = Router();


router.post('/projects/:projectId/proposals', authenticate, authorize('freelancer'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { projectId } = req.params;

    
    const parsed = proposalSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    
    const project = await prisma.project.findUnique({ where: { id: projectId as string } });
    if (!project) {
      return sendError(res, 'PROJECT_NOT_FOUND', 404);
    }

    
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


router.get('/projects/:projectId/proposals', authenticate, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { projectId } = req.params;

    
    const project = await prisma.project.findUnique({ where: { id: projectId as string } });
    if (!project) {
      return sendError(res, 'PROJECT_NOT_FOUND', 404);
    }

   
    if (project.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    
    const proposals = await prisma.proposal.findMany({
      where: { projectId : projectId  as string },
    });

    return sendSuccess(res, proposals);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});


router.put('/proposals/:proposalId/accept', authenticate, authorize('client'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { proposalId } = req.params;

    
    const parsed = acceptProposalSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId as string },
      include: { project: true },
    });

    if (!proposal) {
      return sendError(res, 'PROPOSAL_NOT_FOUND', 404);
    }

    
    if (proposal.status !== 'pending') {
      return sendError(res, 'PROPOSAL_ALREADY_PROCESSED', 400);
    }

    
    if (proposal.project.clientId !== user.id) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    const { milestones } = parsed.data;

    
    const result = await prisma.$transaction(async (tx) => {
      
      const acceptedProposal = await tx.proposal.update({
        where: { id: proposalId as string },
        data: { status: 'accepted' },
      });

      
      await tx.proposal.updateMany({
        where: {
          projectId: proposal.projectId as string,
          id: { not: proposalId as string },
        },
        data: { status: 'rejected' },
      });

      
      await tx.project.update({
        where: { id: proposal.projectId },
        data: { status: 'in_progress' },
      });

      
      const contract = await tx.contract.create({
        data: {
          projectId: proposal.projectId,
          freelancerId: proposal.freelancerId,
          clientId: user.id,
          totalAmount: proposal.proposedPrice,
          status: 'active',
        },
      });

      
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
