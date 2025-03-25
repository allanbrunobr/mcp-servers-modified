import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
import { z } from 'zod';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

// Schema definitions
export const SearchCodeSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  search_text: z.string().describe("The text to search for"),
  file_path: z.string().optional().describe("Optional: filter by file path"),
  top: z.number().optional().describe("Optional: maximum number of results to return (default: 100)"),
});

export const SearchWorkItemsSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  query: z.string().describe("Search query text"),
  state: z.string().optional().describe("Optional: filter by work item state (e.g., 'Active', 'Closed')"),
  type: z.string().optional().describe("Optional: filter by work item type (e.g., 'Bug', 'Task')"),
  assigned_to: z.string().optional().describe("Optional: filter by assigned user"),
  top: z.number().optional().describe("Optional: maximum number of results to return (default: 100)"),
});

export const SearchUsersSchema = z.object({
  query: z.string().describe("Search query text"),
  top: z.number().optional().describe("Optional: maximum number of results to return (default: 100)"),
});

async function searchCode(projectId: string, repositoryId: string, searchText: string, filePath?: string, top: number = 100): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Need to figure out the correct API endpoint for code search
    // This is a placeholder, the actual API endpoint may be different
    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/items?search=${searchText}&api-version=7.1`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function searchWorkItems(projectId: string, query: string, state?: string, type?: string, assignedTo?: string, top: number = 100): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Build the WIQL query
    let wiqlQuery = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.CreatedDate], [System.ChangedDate] FROM WorkItems WHERE [System.TeamProject] = '${projectId}' AND CONTAINS(System.Title, '${query}')`;
    
    if (state) {
      wiqlQuery += ` AND [System.State] = '${state}'`;
    }
    
    if (type) {
      wiqlQuery += ` AND [System.WorkItemType] = '${type}'`;
    }
    
    if (assignedTo) {
      wiqlQuery += ` AND [System.AssignedTo] = '${assignedTo}'`;
    }
    
    wiqlQuery += ` ORDER BY [System.ChangedDate] DESC`;

    const response = await axiosInstance.post(
      `${projectId}/_apis/wit/wiql?api-version=7.1&$top=${top}`,
      {
        query: wiqlQuery
      }
    );

    // Get detailed work item information
    if (response.data.workItems && response.data.workItems.length > 0) {
      const workItemIds = response.data.workItems.map((item: any) => item.id).join(',');
      const detailsResponse = await axiosInstance.get(
        `_apis/wit/workitems?ids=${workItemIds}&api-version=7.1`
      );
      
      return {
        count: detailsResponse.data.count,
        value: detailsResponse.data.value
      };
    }

    return {
      count: 0,
      value: []
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function searchUsers(query: string, top: number = 100): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Search for users in the organization
    const response = await axiosInstance.get(
      `_apis/graph/users?searchString=${encodeURIComponent(query)}&api-version=7.1-preview.1&$top=${top}`
    );

    return {
      count: response.data.count,
      value: response.data.value
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

export { searchCode, searchWorkItems, searchUsers };
