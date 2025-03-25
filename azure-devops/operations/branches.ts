import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
import { z } from 'zod';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

// Schema definitions
export const CreateBranchSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  branch: z.string().describe("Name for the new branch"),
  from_branch: z.string().optional().describe("Optional: source branch to create from (defaults to the repository's default branch)"),
});

export const UpdateBranchSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  branch: z.string().describe("Name of the branch to update"),
  new_commit_id: z.string().describe("The new commit ID to point the branch to"),
  old_commit_id: z.string().describe("The current commit ID of the branch"),
});

async function getBranches(projectId: string, repositoryId: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=7.1`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function getDefaultBranch(projectId: string, repositoryId: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}?api-version=7.1`
    );

    return response.data.defaultBranch;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function getBranchRef(projectId: string, repositoryId: string, branchName: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Ensure branch name is properly formatted
    const formattedBranchName = branchName.startsWith('refs/heads/') 
      ? branchName 
      : `refs/heads/${branchName}`;

    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/refs?filter=${encodeURIComponent(formattedBranchName)}&api-version=7.1`
    );

    if (!response.data.value || response.data.value.length === 0) {
      throw new AzureDevOpsError(`Branch ${branchName} not found`);
    }

    return response.data.value[0];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function getLatestCommit(projectId: string, repositoryId: string, branchName: string): Promise<string> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/commits?searchCriteria.itemVersion.version=${branchName}&searchCriteria.$top=1&api-version=7.1`
    );

    if (!response.data.value || response.data.value.length === 0) {
      throw new AzureDevOpsError(`No commits found for branch ${branchName}`);
    }

    return response.data.value[0].commitId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function createBranch(projectId: string, repositoryId: string, branchName: string, fromBranch?: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Get source branch or default branch
    const sourceBranch = fromBranch || (await getDefaultBranch(projectId, repositoryId)).replace('refs/heads/', '');
    
    // Get the latest commit ID from the source branch
    const commitId = await getLatestCommit(projectId, repositoryId, sourceBranch);

    // Create the new branch
    const response = await axiosInstance.post(
      `${projectId}/_apis/git/repositories/${repositoryId}/refs?api-version=7.1`,
      {
        name: `refs/heads/${branchName}`,
        newObjectId: commitId,
        oldObjectId: '0000000000000000000000000000000000000000' // This indicates a new reference
      }
    );

    return response.data.value[0];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function updateBranch(projectId: string, repositoryId: string, branchName: string, newCommitId: string, oldCommitId: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Ensure branch name is properly formatted
    const formattedBranchName = branchName.startsWith('refs/heads/') 
      ? branchName 
      : `refs/heads/${branchName}`;

    const response = await axiosInstance.post(
      `${projectId}/_apis/git/repositories/${repositoryId}/refs?api-version=7.1`,
      {
        name: formattedBranchName,
        newObjectId: newCommitId,
        oldObjectId: oldCommitId
      }
    );

    return response.data.value[0];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

export { 
  getBranches, 
  getDefaultBranch, 
  getBranchRef, 
  getLatestCommit, 
  createBranch, 
  updateBranch 
};
