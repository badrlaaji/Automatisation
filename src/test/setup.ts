import { execSync } from "child_process";
import path from "path";
import { prisma } from "../database/database";

beforeAll(() => {
  execSync("npx prisma db push --skip-generate", {
    cwd: path.join(__dirname, "..", ".."),
    env: {
      ...process.env,
      DATABASE_URL: "file:../data/test.db",
    },
    stdio: "ignore",
  });
});

beforeEach(async () => {
  await prisma.token.deleteMany();
  await prisma.processInstance.deleteMany();
  await prisma.workflow.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
