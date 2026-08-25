import { getUserInput } from "./input/cli";
import { runAutomation } from "./automation/orchestrator";

async function main() {
  console.log(`
========================================
   Instagram Message Automation
========================================
`);

  const input = await getUserInput();

  try {
    await runAutomation({
      username: input.username,
      password: input.password,
    });
  } catch (error) {
    console.error("\n✗ Automation failed:", error);
    process.exit(1);
  }
}

main();