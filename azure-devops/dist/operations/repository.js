import { AzureDevOpsError } from '../common/errors.js';
import { encodeToBase64 } from '../common/utils.js';
import axios from 'axios';
const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;
async function createRepository(projectId, name, description) {
    try {
        const axiosInstance = axios.create({
            baseURL: ORG_URL,
            headers: {
                Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
                'Content-Type': 'application/json',
            },
        });
        const response = await axiosInstance.post(`_apis/git/repositories?api-version=7.1`, {
            name: name,
            project: {
                id: projectId,
            },
            defaultBranch: 'main',
            description: description,
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
export { createRepository };
