import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import machineRoutes from './routes/machines.js';
import auditRoutes from './routes/audit.js';
import scheduleRoutes from './routes/schedule.js';
import employeeRoutes from './routes/employees.js';
import employeeGroupRoutes from './routes/employeeGroups.js';
import efficiencyRoutes from './routes/efficiency.js';
import reportRoutes from './routes/reports.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/employee-groups', employeeGroupRoutes);
app.use('/api/efficiency', efficiencyRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.send('API de Sacoplast Eficiencias');
});

export default app;