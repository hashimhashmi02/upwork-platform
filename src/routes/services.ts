import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { serviceSchema } from '../validators';

const router = Router();


router.post('/', authenticate, authorize('freelancer'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;

    
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { title, description, category, pricingType, price, deliveryDays } = parsed.data;

    
    const service = await prisma.service.create({
      data: {
        freelancerId: user.id,
        title,
        description,
        category,
        pricingType,
        price,
        deliveryDays,
      },
    });

    return sendSuccess(res, service, 201);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
