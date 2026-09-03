import { config } from "dotenv";
// .env.local 우선, 그다음 .env
config({ path: [".env.local", ".env"] });
