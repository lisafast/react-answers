import { tool } from "@langchain/core/tools";
import { departments_EN } from '../../data/departments/departments_EN.js';
import { departments_FR } from '../../data/departments/departments_FR.js';

/**
 * Looks up the department name and abbreviation for a given URL.
 * @param {object} input - The input object.
 * @param {string} input.url - The URL to lookup the department for.
 * @returns {Promise<string>} - A promise that resolves to a JSON string with department info or 'Department not found'.
 */
// Logic moved inline below
// const lookupDepartmentByURLLogic = async ({ url }) => { ... };

const departmentLookup = tool(
  async ({ url }) => {
    // Normalize the input URL
    const normalizedUrl = url.trim().replace(/\/$/, ''); // Remove trailing slash
    const urlObj = new URL(normalizedUrl);
    const normalizedHostname = urlObj.hostname;
    const normalizedPathname = urlObj.pathname;

    // Combine EN and FR departments with language info
    const allDepartments = [
      ...departments_EN.map(dept => ({ ...dept, lang: 'en' })),
      ...departments_FR.map(dept => ({ ...dept, lang: 'fr' }))
    ];

    for (const department of allDepartments) {
      if (!department.url) continue; // Skip if URL is missing

      // Normalize the department URL
      const deptUrl = department.url.trim().replace(/\/$/, '');
      const deptUrlObj = new URL(deptUrl);
      const deptHostname = deptUrlObj.hostname;
      const deptPathname = deptUrlObj.pathname.replaceAll(".html", ""); 

      // If hostname matches
      if (normalizedHostname === deptHostname) {
        // If hostname contains 'canada.ca', also check pathname
        if (normalizedHostname.includes('canada.ca')) {
          if (normalizedPathname.startsWith(deptPathname)) {
            return JSON.stringify({
              name: department.name,
              abbr: department.abbr || null,
              lang: department.lang,
              url: department.url
            });
          }
        } else {
          // For non-canada.ca domains, hostname match is enough
          return JSON.stringify({
            name: department.name,
            abbr: department.abbr || null,
            lang: department.lang,
            url: department.url
          });
        }
      }
    }

    return "Department not found for the provided URL: " + url;
  }, // <-- Correct placement of closing brace and removal of duplicate return
  {
    name: "departmentLookup",
    description: "Looks up and returns the department name and abbreviation for a given URL. Returns 'Department not found' if no match is found.",
    schema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "The URL to lookup the department for. This is required."
            }
        },
        required: ["url"]
    },
  }
);

export default departmentLookup;
