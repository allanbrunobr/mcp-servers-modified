#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { VERSION } from './common/version.js';
import { encodeToBase64 } from './common/utils.js';
import { AzureDevOpsError } from './common/errors.js';
import * as branches from './operations/branches.js';
import * as commits from './operations/commits.js';
import * as filesModule from './operations/files.js';
import { getFileContent, updateFileContent, createOrUpdateFile, pushFiles, FileOperation } from './operations/files.js';
import * as issues from './operations/issues.js';
import * as pulls from './operations/pulls.js';
import * as repository from './operations/repository.js';
import * as search from './operations/search.js';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL;
const API_TOKEN = process.env.AZURE_DEVOPS_API_TOKEN;

if (!ORG_URL || !API_TOKEN) {
  throw new Error('AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_API_TOKEN environment variables are required');
}

interface AzureDevOpsProject {
  id: string;
  name: string;
  description: string;
  url: string;
}

interface AzureDevOpsRepository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
}

class AzureDevOpsServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'azure-devops-server',
        version: VERSION,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

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

  private setupToolHandlers() {
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
          inputSchema: zodToJsonSchema(search.SearchCodeSchema),
        },
        {
          name: 'search_work_items',
          description: 'Search for work items (issues, tasks, bugs) in a project',
          inputSchema: zodToJsonSchema(search.SearchWorkItemsSchema),
        },
        {
          name: 'search_users',
          description: 'Search for users in the organization',
          inputSchema: zodToJsonSchema(search.SearchUsersSchema),
        },
        {
          name: 'fork_repository',
          description: 'Fork a repository to create a new copy',
          inputSchema: zodToJsonSchema(repository.ForkRepositorySchema),
        },
        {
          name: 'create_branch',
          description: 'Create a new branch in a repository',
          inputSchema: zodToJsonSchema(branches.CreateBranchSchema),
        },
        {
          name: 'update_branch',
          description: 'Update an existing branch to point to a new commit',
          inputSchema: zodToJsonSchema(branches.UpdateBranchSchema),
        },
        {
          name: 'push_files',
          description: 'Push multiple files to a repository in a single commit',
          inputSchema: zodToJsonSchema(filesModule.PushFilesSchema),
        },
        {
          name: 'create_or_update_file',
          description: 'Create a new file or update an existing file',
          inputSchema: zodToJsonSchema(filesModule.CreateOrUpdateFileSchema),
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'get_projects') {
        try {
          const response = await this.axiosInstance.get<{ value: AzureDevOpsProject[] }>(
            `_apis/projects?api-version=7.1`
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data.value, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'get_repositories') {
        const projectId = request.params.arguments?.project_id;
        if (!projectId) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id is required');
        }

        try {
          const response = await this.axiosInstance.get<{ value: AzureDevOpsRepository[] }>(
            `${projectId}/_apis/git/repositories?api-version=7.1`
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data.value, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'create_repository') {
        const projectId = request.params.arguments?.project_id;
        const name = request.params.arguments?.name;
        const description = request.params.arguments?.description;

        if (!projectId || !name) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id and name are required');
        }

        try {
          const response = await repository.createRepository(
            projectId as string,
            name as string,
            (description as string | undefined) ?? ''
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'create_pull_request') {
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
          const response = await pulls.createPullRequest(
            projectId as string,
            repositoryId as string,
            sourceBranch as string,
            targetBranch as string,
            title as string,
            (description as string | undefined) ?? ''
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'add_issue_comment') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const issueId = request.params.arguments?.issue_id;
        const comment = request.params.arguments?.comment;

        if (!projectId || !repositoryId || !issueId || !comment) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, issue_id, and comment are required');
        }

        try {
          const response = await issues.addIssueComment(
            projectId as string,
            repositoryId as string,
            issueId as string,
            comment as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'get_branches') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;

        if (!projectId || !repositoryId) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id and repository_id are required');
        }

        try {
          const response = await branches.getBranches(
            projectId as string,
            repositoryId as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'get_commits') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const branch = request.params.arguments?.branch;

        if (!projectId || !repositoryId || !branch) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and branch are required');
        }

        try {
          const response = await commits.getCommits(
            projectId as string,
            repositoryId as string,
            branch as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'get_file_content') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const filePath = request.params.arguments?.file_path;
        const branch = request.params.arguments?.branch;

        if (!projectId || !repositoryId || !filePath || !branch) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, file_path, and branch are required');
        }

        try {
          const response = await getFileContent(
            projectId as string,
            repositoryId as string,
            filePath as string,
            branch as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'update_file_content') {
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
          const response = await updateFileContent(
            projectId as string,
            repositoryId as string,
            filePath as string,
            branch as string,
            content as string,
            commitMessage as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'search_code') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const searchText = request.params.arguments?.search_text;
        const filePath = request.params.arguments?.file_path;
        const top = request.params.arguments?.top;

        if (!projectId || !repositoryId || !searchText) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and search_text are required');
        }

        try {
          const response = await search.searchCode(
            projectId as string,
            repositoryId as string,
            searchText as string,
            filePath as string | undefined,
            top as number | undefined
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'search_work_items') {
        const projectId = request.params.arguments?.project_id;
        const query = request.params.arguments?.query;
        const state = request.params.arguments?.state;
        const type = request.params.arguments?.type;
        const assignedTo = request.params.arguments?.assigned_to;
        const top = request.params.arguments?.top;

        if (!projectId || !query) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id and query are required');
        }

        try {
          const response = await search.searchWorkItems(
            projectId as string,
            query as string,
            state as string | undefined,
            type as string | undefined,
            assignedTo as string | undefined,
            top as number | undefined
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'search_users') {
        const query = request.params.arguments?.query;
        const top = request.params.arguments?.top;

        if (!query) {
          throw new McpError(ErrorCode.InvalidParams, 'query is required');
        }

        try {
          const response = await search.searchUsers(
            query as string,
            top as number | undefined
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'fork_repository') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const name = request.params.arguments?.name;
        const targetProjectId = request.params.arguments?.target_project_id;

        if (!projectId || !repositoryId || !name) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and name are required');
        }

        try {
          const response = await repository.forkRepository(
            projectId as string,
            repositoryId as string,
            name as string,
            targetProjectId as string | undefined
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'create_branch') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const branch = request.params.arguments?.branch;
        const fromBranch = request.params.arguments?.from_branch;

        if (!projectId || !repositoryId || !branch) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, and branch are required');
        }

        try {
          const response = await branches.createBranch(
            projectId as string,
            repositoryId as string,
            branch as string,
            fromBranch as string | undefined
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'update_branch') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const branch = request.params.arguments?.branch;
        const newCommitId = request.params.arguments?.new_commit_id;
        const oldCommitId = request.params.arguments?.old_commit_id;

        if (!projectId || !repositoryId || !branch || !newCommitId || !oldCommitId) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, branch, new_commit_id, and old_commit_id are required');
        }

        try {
          const response = await branches.updateBranch(
            projectId as string,
            repositoryId as string,
            branch as string,
            newCommitId as string,
            oldCommitId as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'push_files') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const branch = request.params.arguments?.branch;
        const files = request.params.arguments?.files;
        const commitMessage = request.params.arguments?.commit_message;

        if (!projectId || !repositoryId || !branch || !files || !commitMessage) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, branch, files, and commit_message are required');
        }

        try {
          const fileOperations = files as unknown as FileOperation[];
          const response = await pushFiles(
            projectId as string,
            repositoryId as string,
            branch as string,
            fileOperations,
            commitMessage as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else if (request.params.name === 'create_or_update_file') {
        const projectId = request.params.arguments?.project_id;
        const repositoryId = request.params.arguments?.repository_id;
        const path = request.params.arguments?.path;
        const content = request.params.arguments?.content;
        const commitMessage = request.params.arguments?.commit_message;
        const branch = request.params.arguments?.branch;

        if (!projectId || !repositoryId || !path || !content || !commitMessage || !branch) {
          throw new McpError(ErrorCode.InvalidParams, 'project_id, repository_id, path, content, commit_message, and branch are required');
        }

        try {
          const response = await createOrUpdateFile(
            projectId as string,
            repositoryId as string,
            path as string,
            content as string,
            commitMessage as string,
            branch as string
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } catch (error) {
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
      } else {
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
