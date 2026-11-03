import "server-only";
import { crearBD, type BD } from "./db/cliente";

// Una sola conexión por proceso (en desarrollo evita abrir una nueva con cada recarga).
const globalParaBD = globalThis as unknown as { bd?: BD };

export const db: BD = globalParaBD.bd ?? crearBD();

if (process.env.NODE_ENV !== "production") globalParaBD.bd = db;
