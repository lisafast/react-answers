const getApiUrl = (endpoint) => {
  const serverUrl =
    process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "";
  const prefix = endpoint.split('-')[0];
  return `${serverUrl}/api/${prefix}/${endpoint}`;
};

const getProviderApiUrl = (provider, endpoint) => {
  const serverUrl =
    process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "";
  // Map provider aliases to their actual service names
  if (provider === "claude") {
    provider = "anthropic";
  } else if (provider === "openai") {
    provider = "openai";
  } else if (provider === "azure-openai" || provider === "azure") {
    provider = "azure";
  }

  return `${serverUrl}/api/${provider}/${provider}-${endpoint}`;
};

const providerOrder = ["openai", "azure", "anthropic", "cohere"];

// Generic function to prepend development server URL to any relative API path
const getAbsoluteApiUrl = (relativePath) => {
  // Ensure the relative path starts with a slash
  if (!relativePath.startsWith('/')) {
    console.warn(`getAbsoluteApiUrl expects a path starting with '/', received: ${relativePath}`);
    relativePath = `/${relativePath}`;
  }
  const serverUrl =
    process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "";
  return `${serverUrl}${relativePath}`;
};

export { getApiUrl, getProviderApiUrl, getAbsoluteApiUrl, providerOrder };
