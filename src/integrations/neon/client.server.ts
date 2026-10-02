import { neon } from "@neondatabase/serverless";

export function getDb() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    "postgresql://neondb_owner:npg_smui0WFqZ6Oh@ep-patient-dew-azmm384u-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

  return neon(connectionString);
}
