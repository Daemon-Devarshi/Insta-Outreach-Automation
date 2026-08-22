import inquirer from "inquirer";

export async function getInputs() {
  return await inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "Instagram username:",
      validate(value: string) {
        return value.trim().length > 0 ? true : "Username cannot be empty.";
      },
    },
    {
      type: "password",
      name: "password",
      message: "Instagram password:",
      mask: "*",
      validate(value: string) {
        return value.trim().length > 0 ? true : "Password cannot be empty.";
      },
    },
  ]);
}