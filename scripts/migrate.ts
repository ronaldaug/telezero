import 'dotenv/config';
import { migrate } from '../src/database/index.js';

try {
    migrate();
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
