import { Router } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { projectSchema } from '../validators';

const router = Router();

// POST /api/projects — Client only
router.post('/', authenticate, authorize('client'), async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;

    // Validate request body
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { title, description, category, budgetMin, budgetMax, deadline, requiredSkills } = parsed.data;

    // Check deadline is in the future
    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    // Create the project
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

// GET /api/projects — Auth required, with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, minBudget, skills } = req.query;

    // Build dynamic where clause based on query params
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
