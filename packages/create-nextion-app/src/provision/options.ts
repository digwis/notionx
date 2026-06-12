export type ProvisionModeName = "create" | "repair";

export interface ProvisionMode {
  name: ProvisionModeName;
  deploy: boolean;
  allowRemoteMigrations: boolean;
}

export function defaultProvisionMode(name: ProvisionModeName): ProvisionMode {
  if (name === "repair") {
    return {
      name,
      deploy: false,
      allowRemoteMigrations: false,
    };
  }

  return {
    name,
    deploy: true,
    allowRemoteMigrations: true,
  };
}
