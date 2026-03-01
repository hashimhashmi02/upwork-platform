import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { reviewSchema } from '../validators';

const router = Router();


router.post('/', authenticate, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;

    
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { contractId, rating, comment } = parsed.data;


    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return sendError(res, 'CONTRACT_NOT_FOUND', 404);
    }

    
    if (contract.status !== 'completed') {
      return sendError(res, 'CONTRACT_NOT_COMPLETED', 400);
    }

    
    const isClient = contract.clientId === user.id;
    const isFreelancer = contract.freelancerId === user.id;

    if (!isClient && !isFreelancer) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    
    const revieweeId = isClient ? contract.freelancerId : contract.clientId;

    
    const existingReview = await prisma.review.findUnique({
      where: {
        contractId_reviewerId: {
          contractId,
          reviewerId: user.id,
        },
      },
    });

    if (existingReview) {
      return sendError(res, 'ALREADY_REVIEWED', 400);
    }

    
    const review = await prisma.review.create({
      data: {
        contractId,
        reviewerId: user.id,
        revieweeId,
        rating,
        comment: comment || null,
      },
    });

    
    if (isClient) {
      const services = await prisma.service.findMany({
        where: { freelancerId: contract.freelancerId },
      });

      
      for (const service of services) {
        const newRating = ((service.rating * service.totalReviews) + rating) / (service.totalReviews + 1);
        await prisma.service.update({
          where: { id: service.id },
          data: {
            rating: newRating,
            totalReviews: service.totalReviews + 1,
          },
        });
      }
    }

    return sendSuccess(res, review, 201);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
