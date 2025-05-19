export const CONTEXT_PROMPT = `
Step 2: DETERMINE CONTEXT
## Matching Algorithm:
1. Extract key topics and entities from the user's question and context
- Prioritize your analysis of the question and context, including referring-url (the page the user was on when they asked the question) over the <searchResults> 
- <referring-url> often identifies the department in a segment but occasionally may betray a misunderstanding. For example, the user may be on the MSCA sign in page but their question is how to sign in to get their Notice of Assessment, which is done through their CRA account.
2. Compare and select ONLY if there is a match from the departmentLookup tool or from the list of generic canada.ca pages
3. DO NOT match to programs, benefits, or services - only match to their administering department from the departmentLookup tool.
4. If multiple departments could be responsible:
   - Select the department that most likely directly administers and delivers web content for the program/service
   - OR leave department empty and if relevant, select one of the cross-department canada.ca urls from this set as the departmentUrl in the matching page-language:
      Direct deposit/Dépôt direct: https://www.canada.ca/en/public-services-procurement/services/payments-to-from-government/direct-deposit.html or fr:  https://www.canada.ca/fr/services-publics-approvisionnement/services/paiements-vers-depuis-gouvernement/depot-direct.html 
      Change of address/Changement d'adresse: https://www.canada.ca/en/government/change-address.html or fr: https://www.canada.ca/fr/gouvernement/changement-adresse.html
      GCKey help/Aide pour GCKey: https://www.canada.ca/en/government/sign-in-online-account/gckey.html or fr: https://www.canada.ca/fr/gouvernement/ouvrir-session-dossier-compte-en-ligne/clegc.html
      Find a member of Parliament/Trouver un député: https://www.ourcommons.ca/Members/en/search or fr: https://www.noscommunes.ca/Members/fr/search
      Response to US tariffs: https://international.canada.ca/en/global-affairs/campaigns/canada-us-engagement or fr: https://international.canada.ca/fr/affaires-mondiales/campagnes/engagement-canada-etats-unis
     All Government of Canada contacts: https://www.canada.ca/en/contact.html or fr: https://www.canada.ca/fr/contact.html
     All Government of Canada departments and agencies: https://www.canada.ca/en/government/dept.html or fr:  https://www.canada.ca/fr/gouvernement/min.html
     All Government of Canada services (updated Feb 2025): https://www.canada.ca/en/services.html or fr: https://www.canada.ca/fr/services.html

5. If no clear department match exists and no cross-department canada.ca url is relevant, return empty values  

## Examples of Program-to-Department Mapping:
- Canada Pension Plan (CPP), OAS, Disability pension, EI, Canadian Dental Care Plan → ESDC (administering department)
- Canada Child Benefit → CRA (administering department)
- Job Bank, Apprenticeships, Student Loans→ ESDC (administering department)
- Weather Forecasts → ECCC (administering department)
- My Service Canada Account → ESDC (administering department)
- Visa, ETA, entry to Canada → IRCC (administering department)
- Ontario Trillium Benefit → CRA (administering department)
- Canadian Armed Forces Pensions → PSPC (administering department)
- Veterans benefits → VAC (administering department)
- Public service group insurance benefit plans → TBS (administering department)
- Public service collective agreements → TBS (administering department)
- Public service pay system → PSPC (administering department)
- Public service jobs, language requirements, tests, applications and GC Jobs → PSC (administering department)
- International students study permits and visas → IRCC (administering department)
- International students find schools and apply for scholarships on Educanada → EDU (separate official website administered by GAC)

## Response Format:
<analysis>
<department>[EXACT department abbreviation from departments_list> OR empty string]</department>
<departmentUrl>[EXACT departmentmatching URL from departments_list> OR empty string]</departmentUrl>
</analysis>

## Examples:
<examples>
<example>
* A question about the weather forecast would match:
<analysis>
<department>ECCC</department>
<departmentUrl>https://www.canada.ca/en/environment-climate-change.html</departmentUrl>
</analysis>
</example>

<example>
* A question about recipe ideas doesn't match any government departments:
<analysis>
<department></department>
<departmentUrl></departmentUrl>
</analysis>
</example>

<example>
* A question about renewing a passport (asked on the French page) would match IRCC:
<analysis>
<department>IRCC</department>
<departmentUrl>https://www.canada.ca/fr/immigration-refugies-citoyennete.html</departmentUrl>
</analysis>
</example>
</examples>
`;

 