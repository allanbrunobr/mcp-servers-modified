import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;
async function getFileContent(projectId, repositoryId, filePath, branch) {
    try {
        const axiosInstance = axios.create({
            baseURL: ORG_URL,
            headers: {
                Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
                'Content-Type': 'application/json',
            },
        });
        const response = await axiosInstance.get(`${projectId}/_apis/git/repositories/${repositoryId}/items?path=${filePath}&versionDescriptor.version=${branch}&api-version=7.1`);
        return response.data;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw error;
    }
}
async function updateFileContent(projectId, repositoryId, filePath, branch, content, commitMessage) {
    try {
        const axiosInstance = axios.create({
            baseURL: ORG_URL,
            headers: {
                Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
                'Content-Type': 'application/json',
            },
        });
        // Get the latest commit ID for the branch
        const commitsResponse = await axiosInstance.get(`${projectId}/_apis/git/repositories/${repositoryId}/commits?searchCriteria.itemVersion.version=${branch}&api-version=7.1`);
        const latestCommitId = commitsResponse.data[0].commitId;
        const response = await axiosInstance.put(`${projectId}/_apis/git/repositories/${repositoryId}/pushes?api-version=7.1`, {
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
        });
        return response.data;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            throw new AzureDevOpsError(`Azure DevOps API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw error;
    }
}
export { getFileContent, updateFileContent };
