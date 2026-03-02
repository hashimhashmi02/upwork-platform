import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();


router.get('/', authenticate, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const { status, role } = req.query;

    
    const where: any = {
      OR: [
        { clientId: user.id },
        { freelancerId: user.id },
      ],
    };

    
    if (status) {
      where.status = status as string;
    }

    
    if (role === 'client') {
      delete where.OR;
      where.clientId = user.id;
    } else if (role === 'freelancer') {
      delete where.OR;
      where.freelancerId = user.id;
    }

    if (status) {
      where.status = status as string;
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        milestones: true,
      },
    });

    return sendSuccess(res, contracts);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
