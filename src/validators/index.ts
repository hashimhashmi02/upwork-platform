import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(['client', 'freelancer']).optional(),
  bio: z.string().optional(),
  skills: z.array(z.string()).optional(),
  hourlyRate: z.number().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const serviceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  pricingType: z.enum(['fixed', 'hourly']),
  price: z.number().positive(),
  deliveryDays: z.number().int().positive(),
});

export const projectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  budgetMin: z.number(),
  budgetMax: z.number(),
  deadline: z.string().min(1),
  requiredSkills: z.array(z.string()).optional(),
});

export const proposalSchema = z.object({
  coverLetter: z.string().min(1),
  proposedPrice: z.number().positive(),
  estimatedDuration: z.number().int().positive(),
});

export const acceptProposalSchema = z.object({
  milestones: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().positive(),
      dueDate: z.string().min(1),
    })
  ).min(1),
});

export const reviewSchema = z.object({
  contractId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
