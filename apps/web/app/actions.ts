"use server";

import { CreateosSandboxClient } from "@nodeops-createos/sandbox";

const getSandboxClient = () => {
  const apiKey =
    process.env.CREATEOS_SANDBOX_API_KEY ||
    process.env.CREATEOS_PROJECT_API_KEY ||
    process.env.CREATEOS_PLAN_API_KEY;
  const baseUrl =
    process.env.CREATEOS_SANDBOX_BASE_URL ||
    process.env.CREATEOS_PROJECT_API_URL ||
    "https://api-eu.sb.createos.sh/";

  return new CreateosSandboxClient({
    baseUrl,
    apiKey,
  });
};

export async function increaseTimeout(sandboxId: string) {
  try {
    const client = getSandboxClient();
    const sandbox = await client.getSandbox(sandboxId);
    if (sandbox) {
      await sandbox.setAutoPause(600);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to increase timeout for CreateOS sandbox:", error);
    return false;
  }
}

export async function stopSandboxAction(sandboxId: string) {
  try {
    const client = getSandboxClient();
    const sandbox = await client.getSandbox(sandboxId);
    if (sandbox) {
      await sandbox.destroy();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to stop CreateOS sandbox:", error);
    return false;
  }
}
