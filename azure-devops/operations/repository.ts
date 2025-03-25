import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
import { z } from 'zod';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

// Schema definitions
export const SearchRepositoriesSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  query: z.string().describe("Search query text"),
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
  perPage: z.number().optional().describe("Number of results per page (default: 30, max: 100)"),
});

export const ForkRepositorySchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository to fork"),
  name: z.string().describe("The name for the new forked repository"),
  target_project_id: z.string().optional().describe("Optional: target project ID to fork to (defaults to the same project)"),
});

async function createRepository(projectId: string, name: string, description: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.post(
      `_apis/git/repositories?api-version=7.1`,
      {
        name: name,
        project: {
          id: projectId,
        },
        defaultBranch: 'main',
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

async function searchRepositories(projectId: string, query: string, page: number = 1, perPage: number = 30): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Azure DevOps doesn't have a direct repository search API like GitHub
    // We'll get all repositories and filter them client-side
    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories?api-version=7.1`
    );

    // Filter repositories by name containing the query (case insensitive)
    const filteredRepos = response.data.value.filter((repo: any) => 
      repo.name.toLowerCase().includes(query.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(query.toLowerCase()))
    );

    // Handle pagination
    const startIndex = (page - 1) * perPage;
    const paginatedRepos = filteredRepos.slice(startIndex, startIndex + perPage);

    return {
      total_count: filteredRepos.length,
      items: paginatedRepos,
      page: page,
      perPage: perPage,
      totalPages: Math.ceil(filteredRepos.length / perPage)
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function forkRepository(projectId: string, repositoryId: string, name: string, targetProjectId?: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Get source repository details
    const sourceRepoResponse = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}?api-version=7.1`
    );
    const sourceRepo = sourceRepoResponse.data;

    // Create a new repository with the same properties
    const targetProject = targetProjectId || projectId;
    const newRepo = await createRepository(targetProject, name, `Fork of ${sourceRepo.name}: ${sourceRepo.description || ''}`);

    // Import the source repository content to the new repository
    // Note: This is a simplified implementation. In a real implementation,
    // you would need to clone all branches, tags, etc.
    await axiosInstance.post(
      `${targetProject}/_apis/git/repositories/${newRepo.id}/importRequests?api-version=7.1`,
      {
        parameters: {
          gitSource: {
            url: sourceRepo.remoteUrl
          }
        }
      }
    );

    return {
      ...newRepo,
      source: sourceRepo
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

export { createRepository, searchRepositories, forkRepository };
