import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

async function createPullRequest(projectId: string, repositoryId: string, sourceBranch: string, targetBranch: string, title: string, description: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.post(
      `${projectId}/_apis/git/repositories/${repositoryId}/pullrequests?api-version=7.1`,
      {
        sourceRefName: `refs/heads/${sourceBranch}`,
        targetRefName: `refs/heads/${targetBranch}`,
        title: title,
        description: description,
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

export { createPullRequest };
