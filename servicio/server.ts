import { servir } from './servidor.mjs';

servir('0.0.0.0', Number(process.env.PORT ?? 3000));
