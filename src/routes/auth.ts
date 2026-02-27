import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { signupSchema, loginSchema } from '../validators';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    // Validate request body with Zod
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { name, email, password, role, bio, skills, hourlyRate } = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 'EMAIL_ALREADY_EXISTS', 400);
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - default role is 'client' if not provided
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'client',
        bio: bio || null,
        skills: skills || [],
        hourlyRate: hourlyRate || null,
      },
    });

    // Return user data WITHOUT password
    return sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      bio: user.bio,
      skills: user.skills,
      hourlyRate: user.hourlyRate,
    }, 201);
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'INVALID_REQUEST', 400);
    }

    const { email, password } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendError(res, 'INVALID_CREDENTIALS', 401);
    }

    // Compare password with bcrypt
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return sendError(res, 'INVALID_CREDENTIALS', 401);
    }

    // Sign JWT token with user id and role
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Return token + user info (no password)
    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return sendError(res, 'INTERNAL_SERVER_ERROR', 500);
  }
});

export default router;
