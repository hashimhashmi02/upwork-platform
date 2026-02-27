import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { reviewSchema } from '../validators';

const router = Router();

// POST /api/reviews — Contract participants only, after completion
router.post('/', authenticate, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;

    // Validate request body
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { contractId, rating, comment } = parsed.data;

    // Find the contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return sendError(res, 'CONTRACT_NOT_FOUND', 404);
    }

    // Contract must be completed to leave a review
    if (contract.status !== 'completed') {
      return sendError(res, 'CONTRACT_NOT_COMPLETED', 400);
    }

    // Reviewer must be a participant (client or freelancer on this contract)
    const isClient = contract.clientId === user.id;
    const isFreelancer = contract.freelancerId === user.id;

    if (!isClient && !isFreelancer) {
      return sendError(res, 'FORBIDDEN', 403);
    }

    // Determine reviewee: if client reviews → reviewee is freelancer, and vice versa
    const revieweeId = isClient ? contract.freelancerId : contract.clientId;

    // Check if already reviewed by this user
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

    // Create the review
    const review = await prisma.review.create({
      data: {
        contractId,
        reviewerId: user.id,
        revieweeId,
        rating,
        comment: comment || null,
      },
    });

    // Update freelancer's service ratings (rolling average)
    // Only update if the reviewee is a freelancer
    if (isClient) {
      const services = await prisma.service.findMany({
        where: { freelancerId: contract.freelancerId },
      });

      // Update each service's rating using rolling average formula
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
