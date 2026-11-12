import { z } from 'zod';

// Match PostgreSQL's integer storage rather than imposing a product cap of 100.
export const maxConnectionsSchema = z.number().int().min(1).max(2_147_483_647).default(1);