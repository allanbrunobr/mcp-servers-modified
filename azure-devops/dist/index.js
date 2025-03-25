#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { VERSION } from './common/version.js';
import { encodeToBase64 } from './common/utils.js';
import { AzureDevOpsError } from './common/errors.js';
import * as branches from './operations/branches.js';
import * as commits from './operations/commits.js';
import * as files from './operations/files.js';
import * as issues from './operations/issues.js';
import * as pulls from './operations/pulls.js';
import * as repository from './operations/repository.js';
import * as search from './operations/search.js';
const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;
if (!ORG_URL || !API_TOKEN) {
    throw new Error('AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_API_TOKEN environment variables are required');
}
class AzureDevOpsServer {
    server;
    axiosInstance;
    constructor() {
        this.server = new Server({
            name: 'azure-devops-server',
            version: VERSION,
        }, {
            capabilities: {
                resources: {},
                tools: {},
            },
        });
        this.axiosInstance = axios.create({
            baseURL: ORG_URL,
            headers: {
                Authorization: `Basic ${encodeToBase64(':' + API_TOKEN)}`,
                'Content-Type': 'application/json',
            },
        });
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_projects',
                    description: 'Get a list of Azure DevOps projects',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'get_repositories',
                    description: 'Get a list of repositories for a project',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                        },
                        required: ['project_id'],
                    },
                },
                {
                    name: 'create_repository',
                    description: 'Create a new repository',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            name: {
                                type: 'string',
                                description: 'The name of the repository',
                            },
                            description: {
                                type: 'string',
                                description: 'The description of the repository',
                            },
                        },
                        required: ['project_id', 'name'],
                    },
                },
                {
                    name: 'create_pull_request',
                    description: 'Create a new pull request',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            source_branch: {
                                type: 'string',
                                description: 'The source branch',
                            },
                            target_branch: {
                                type: 'string',
                                description: 'The target branch',
                            },
                            title: {
                                type: 'string',
                                description: 'The title of the pull request',
                            },
                            description: {
                                type: 'string',
                                description: 'The description of the pull request',
                            },
                        },
                        required: ['project_id', 'repository_id', 'source_branch', 'target_branch', 'title'],
                    },
                },
                {
                    name: 'add_issue_comment',
                    description: 'Add a comment to an existing issue',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            issue_id: {
                                type: 'string',
                                description: 'The ID of the issue',
                            },
                            comment: {
                                type: 'string',
                                description: 'The comment to add',
                            },
                        },
                        required: ['project_id', 'repository_id', 'issue_id', 'comment'],
                    },
                },
                {
                    name: 'get_branches',
                    description: 'Get a list of branches for a repository',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                        },
                        required: ['project_id', 'repository_id'],
                    },
                },
                {
                    name: 'get_commits',
                    description: 'Get a list of commits for a branch',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            branch: {
                                type: 'string',
                                description: 'The branch to get commits from',
                            },
                        },
                        required: ['project_id', 'repository_id', 'branch'],
                    },
                },
                {
                    name: 'get_file_content',
                    description: 'Get the content of a file',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            file_path: {
                                type: 'string',
                                description: 'The path to the file',
                            },
                            branch: {
                                type: 'string',
                                description: 'The branch to get the file from',
                            },
                        },
                        required: ['project_id', 'repository_id', 'file_path', 'branch'],
                    },
                },
                {
                    name: 'update_file_content',
                    description: 'Update the content of a file',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            file_path: {
                                type: 'string',
                                description: 'The path to the file',
                            },
                            branch: {
                                type: 'string',
                                description: 'The branch to update the file in',
                            },
                            content: {
                                type: 'string',
                                description: 'The new content of the file',
                            },
                            commit_message: {
                                type: 'string',
                                description: 'The commit message',
                            },
                        },
                        required: ['project_id', 'repository_id', 'file_path', 'branch', 'content', 'commit_message'],
                    },
                },
                {
                    name: 'search_code',
                    description: 'Search for code in a repository',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            project_id: {
                                type: 'string',
                                description: 'The ID of the project',
                            },
                            repository_id: {
                                type: 'string',
                                description: 'The ID of the repository',
                            },
                            search_text: {
                                type: 'string',
                                description: 'The text to search for',
                            },
                        },
                        required: ['project_id', 'repository_id', 'search_text'],
                    },
                }
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === 'get_projects') {
                try {
                    const response = await this.axiosInstance.get(`_apis/projects?api-version=7.1`);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response.data.value, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (axios.isAxiosError(error)) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'get_repositories') {
                const projectId = request.params.arguments?.project_id;
                if (!projectId) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id is required');
                }
                try {
                    const response = await this.axiosInstance.get(`${projectId}/_apis/git/repositories?api-version=7.1`);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response.data.value, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (axios.isAxiosError(error)) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'create_repository') {
                const projectId = request.params.arguments?.project_id;
                const name = request.params.arguments?.name;
                const description = request.params.arguments?.description;
                if (!projectId || !name) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id and name are required');
                }
                try {
                    const response = await repository.createRepository(projectId, name, description ?? '');
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'create_pull_request') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const sourceBranch = request.params.arguments?.source_branch;
                const targetBranch = request.params.arguments?.target_branch;
                const title = request.params.arguments?.title;
                const description = request.params.arguments?.description;
                if (!projectId || !repositoryId || !sourceBranch || !targetBranch || !title) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, source_branch, target_branch, and title are required');
                }
                try {
                    const response = await pulls.createPullRequest(projectId, repositoryId, sourceBranch, targetBranch, title, description ?? '');
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'add_issue_comment') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const issueId = request.params.arguments?.issue_id;
                const comment = request.params.arguments?.comment;
                if (!projectId || !repositoryId || !issueId || !comment) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, issue_id, and comment are required');
                }
                try {
                    const response = await issues.addIssueComment(projectId, repositoryId, issueId, comment);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'get_branches') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                if (!projectId || !repositoryId) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id and repository_id are required');
                }
                try {
                    const response = await branches.getBranches(projectId, repositoryId);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'get_commits') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const branch = request.params.arguments?.branch;
                if (!projectId || !repositoryId || !branch) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and branch are required');
                }
                try {
                    const response = await commits.getCommits(projectId, repositoryId, branch);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'get_file_content') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const filePath = request.params.arguments?.file_path;
                const branch = request.params.arguments?.branch;
                if (!projectId || !repositoryId || !filePath || !branch) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, file_path, and branch are required');
                }
                try {
                    const response = await files.getFileContent(projectId, repositoryId, filePath, branch);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'update_file_content') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const filePath = request.params.arguments?.file_path;
                const branch = request.params.arguments?.branch;
                const content = request.params.arguments?.content;
                const commitMessage = request.params.arguments?.commit_message;
                if (!projectId || !repositoryId || !filePath || !branch || !content || !commitMessage) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, file_path, branch, content, and commit_message are required');
                }
                try {
                    const response = await files.updateFileContent(projectId, repositoryId, filePath, branch, content, commitMessage);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else if (request.params.name === 'search_code') {
                const projectId = request.params.arguments?.project_id;
                const repositoryId = request.params.arguments?.repository_id;
                const searchText = request.params.arguments?.search_text;
                if (!projectId || !repositoryId || !searchText) {
                    throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and search_text are required');
                }
                try {
                    const response = await search.searchCode(projectId, repositoryId, searchText);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(response, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    if (error instanceof AzureDevOpsError) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Azure DevOps API error: ${error.message}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            else {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Azure DevOps MCP server running on stdio');
    }
}
async function run() {
    const server = new AzureDevOpsServer();
    server.run().catch(console.error);
}
run();
