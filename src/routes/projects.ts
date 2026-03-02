import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { projectSchema } from '../validators';

const router = Router();


router.post('/', authenticate, authorize('client'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;

    
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { title, description, category, budgetMin, budgetMax, deadline, requiredSkills } = parsed.data;

    
    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    
    const project = await prisma.project.create({
      data: {
        clientId: user.id,
        title,
        description,
        category,
        budgetMin,
        budgetMax,
        deadline: deadlineDate,
        status: 'open',
        requiredSkills: requiredSkills || [],
      },
    });

    return sendSuccess(res, project, 201);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});


router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, minBudget, skills } = req.query;

    
    const where: any = {};

    if (category) {
      where.category = category as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (minBudget) {
      where.budgetMax = {
        gte: parseFloat(minBudget as string),
      };
    }

    const projects = await prisma.project.findMany({ where });

    return sendSuccess(res, projects);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
