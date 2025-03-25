export interface AzureDevOpsProject {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface AzureDevOpsRepository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
}
