import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';
import projectRoutes from './routes/projects';
import proposalRoutes from './routes/proposals';
import contractRoutes from './routes/contracts';
import milestoneRoutes from './routes/milestones';
import reviewRoutes from './routes/reviews';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', proposalRoutes);          // handles /api/projects/:id/proposals AND /api/proposals/:id/accept
app.use('/api/contracts', contractRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/reviews', reviewRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
