import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
import { z } from 'zod';
import { getLatestCommit } from './branches.js';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

// Schema definitions
export const FileOperationSchema = z.object({
  path: z.string().describe("Path to the file"),
  content: z.string().describe("Content of the file"),
});

export const PushFilesSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  branch: z.string().describe("Branch to push to"),
  files: z.array(FileOperationSchema).describe("Array of files to push"),
  commit_message: z.string().describe("Commit message"),
});

export const GetFileContentsSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  path: z.string().describe("Path to the file or directory"),
  branch: z.string().describe("Branch to get contents from"),
});

export const CreateOrUpdateFileSchema = z.object({
  project_id: z.string().describe("The ID of the project"),
  repository_id: z.string().describe("The ID of the repository"),
  path: z.string().describe("Path where to create/update the file"),
  content: z.string().describe("Content of the file"),
  commit_message: z.string().describe("Commit message"),
  branch: z.string().describe("Branch to create/update the file in"),
});

export type FileOperation = z.infer<typeof FileOperationSchema>;

async function getFileContent(projectId: string, repositoryId: string, filePath: string, branch: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/items?path=${filePath}&versionDescriptor.version=${branch}&api-version=7.1`
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

async function createOrUpdateFile(projectId: string, repositoryId: string, filePath: string, content: string, commitMessage: string, branch: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Get the latest commit ID for the branch
    const commitsResponse = await axiosInstance.get(
      `${projectId}/_apis/git/repositories/${repositoryId}/commits?searchCriteria.itemVersion.version=${branch}&api-version=7.1`
    );

    const latestCommitId = commitsResponse.data[0].commitId;

    const response = await axiosInstance.put(
      `${projectId}/_apis/git/repositories/${repositoryId}/pushes?api-version=7.1`,
      {
        refUpdates: [
          {
            name: `refs/heads/${branch}`,
            oldObjectId: latestCommitId,
          },
        ],
        commits: [
          {
            comment: commitMessage,
            changes: [
              {
                changeType: 'edit',
                item: {
                  path: filePath,
                },
                newContent: {
                  contentType: 'rawtext',
                  content: content,
                },
              },
            ],
          },
        ],
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

async function pushFiles(projectId: string, repositoryId: string, branch: string, files: FileOperation[], commitMessage: string): Promise<any> {
  try {
    const axiosInstance = axios.create({
      baseURL: ORG_URL,
      headers: {
        Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
        'Content-Type': 'application/json',
      },
    });

    // Get the latest commit ID for the branch
    const latestCommitId = await getLatestCommit(projectId, repositoryId, branch);

    // Prepare the changes for all files
    const changes = files.map(file => ({
      changeType: 'edit', // 'add' for new files, 'edit' for existing files, but 'edit' works for both
      item: {
        path: file.path,
      },
      newContent: {
        contentType: 'rawtext',
        content: file.content,
      },
    }));

    // Create a push with all changes in a single commit
    const response = await axiosInstance.post(
      `${projectId}/_apis/git/repositories/${repositoryId}/pushes?api-version=7.1`,
      {
        refUpdates: [
          {
            name: `refs/heads/${branch}`,
            oldObjectId: latestCommitId,
          },
        ],
        commits: [
          {
            comment: commitMessage,
            changes: changes,
          },
        ],
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

export { 
  getFileContent, 
  createOrUpdateFile as updateFileContent, 
  createOrUpdateFile,
  pushFiles 
};
