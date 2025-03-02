import * as XLSX from 'xlsx';
import { flatten } from 'flat';
const ExportService = {

    jsonToFlatTable: (data, headers) => {

        // Ensure data is an array and not null/undefined
        if (!Array.isArray(data) || data.length === 0) {
            console.error("jsonToFlatTable: Received invalid or empty data", data);
            return { headers: [], rows: [] };
        }

        // Step 1: Filter out null/undefined objects before flattening
        const validItems = data.filter(item => item && typeof item === "object");

        if (validItems.length === 0) {
            console.error("jsonToFlatTable: No valid objects to process");
            return { headers: [], rows: [] };
        }

        // Step 2: Flatten each object safely
        const flattenedItems = validItems.map(obj => flatten(obj));

        // Step 3: Create rows, ensuring consistent header order
        const rows = flattenedItems.map(item =>
            headers.map(header => item[header] ?? '')
        );

        return rows;

    },

    getHeaders: (data) => {
        if (!Array.isArray(data) || data.length === 0) {
            console.error("getHeaders: Received invalid or empty data", data);
            return [];
        }

        const validItems = data.filter(item => item && typeof item === "object");

        if (validItems.length === 0) {
            console.error("getHeaders: No valid objects to process");
            return [];
        }

        const flattenedItems = validItems.map(obj => flatten(obj));
        return [...new Set(flattenedItems.flatMap(Object.keys))];
    },

    worksheetDataToCSV(worksheetData, filename) {
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch Data');
        const csvBuffer = XLSX.write(workbook, { bookType: 'csv', type: 'array' });
        const blob = new Blob([csvBuffer], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    worksheetDataToExcel(worksheetData, filename) {
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Bold the headings
        const headingRange = XLSX.utils.decode_range(worksheet['!ref']);
        for (let C = headingRange.s.c; C <= headingRange.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!worksheet[cellAddress]) continue;
            if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
            if (!worksheet[cellAddress].s.font) worksheet[cellAddress].s.font = {};
            worksheet[cellAddress].s.font.bold = true;
        }

        // Add filters
        worksheet['!autofilter'] = { ref: worksheet['!ref'] };

        // Adjust column widths
        const colWidths = worksheetData[0].map((_, colIndex) => ({
            wch: Math.max(...worksheetData.map(row => (row[colIndex] ? row[colIndex].toString().length : 10)))
        }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch Data');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    toSpreadsheet: async (chats, headerOrder, type = 'excel', filename) => {
        const worksheetData = [];
        const headersSet = new Set(chats.flatMap(chat => ExportService.getHeaders(chat.interactions)));
        const headers = ['uniqueID', ...Array.from(headersSet)];
        for (const chat of chats) {
            const interactions = chat.interactions.map(interaction => ({
                ...interaction,
                uniqueID: chat.chatId ? 
                    `${chat.chatId}${interaction.interactionId}` : 
                    `${chat.batchId || 'batch'}_${interaction.interactionId}`
            }));
            const items = interactions;
            const rows = ExportService.jsonToFlatTable(items, headers);
            const filteredHeaders = headers.filter(header => !header.includes('_id') && !header.includes('__v'));
            const filteredRows = rows.map(row =>
                filteredHeaders.map(header => row[headers.indexOf(header)])
            );

            // Make sure we include the referringUrl from both the chat level and interaction level
            const globalInfo = [
                chat.chatId, 
                chat.pageLanguage, 
                chat.aiProvider, 
                chat.searchProvider,
                // Format download logs into comma-separated strings
                chat.downloadStartLogs ? chat.downloadStartLogs.map(log => {
                    const match = log.message.match(/webpage: (.*?)(?:\s|$)/);
                    return match ? match[1] : '';
                }).filter(url => url).join(', ') : '',
                chat.downloadCompleteLogs ? chat.downloadCompleteLogs.map(log => {
                    const match = log.message.match(/webpage: (.*?)(?:\s|$)/);
                    return match ? match[1] : '';
                }).filter(url => url).join(', ') : ''
            ];
            const globalInfoHeaders = ['chatId', 'pageLanguage', 'aiService', 'searchService', 'startedDownloads', 'completedDownloads'];

            const rowsWithGlobalInfo = filteredRows.map(row => globalInfo.concat(row));

            // Update headers to include chatInfoHeaders
            const updatedHeaders = globalInfoHeaders.concat(filteredHeaders);

            // Update orderedHeaders and orderedRows to include chatInfo
            const orderedHeaders = headerOrder.map(headerObj => headerObj.dataLabel)
                .concat(updatedHeaders.filter(header => !headerOrder.some(headerObj => headerObj.dataLabel === header)));

            const orderedRows = rowsWithGlobalInfo.map(row =>
                orderedHeaders.map(header => row[updatedHeaders.indexOf(header)])
            );

            const finalHeaders = orderedHeaders.map(header => {
                const headerObj = headerOrder.find(headerObj => headerObj.dataLabel === header);
                return headerObj ? headerObj.outputLabel : header;
            });

            if (worksheetData.length === 0) {
                worksheetData.push(finalHeaders);
            }
            worksheetData.push(...orderedRows);
        }

        if (type === 'xlsx') {
            ExportService.worksheetDataToExcel(worksheetData, filename);
        } else if (type === 'csv') {
            ExportService.worksheetDataToCSV(worksheetData, filename);
        }
    },

    export: (items, filename) => {
        const headerOrder = [
            { dataLabel: 'uniqueID', outputLabel: 'uniqueID' },
            { dataLabel: 'chatId', outputLabel: 'chatId' },
            { dataLabel: 'createdAt', outputLabel: 'createdAt' },
            { dataLabel: 'pageLanguage', outputLabel: 'pageLanguage' },
            { dataLabel: 'referringUrl', outputLabel: 'referringUrl' },
            { dataLabel: 'question.language', outputLabel: 'questionLanguage' },
            { dataLabel: 'question.redactedQuestion', outputLabel: 'redactedQuestion' },
            { dataLabel: 'aiService', outputLabel: 'aiService' },
            { dataLabel: 'searchService', outputLabel: 'searchService' },
            { dataLabel: 'answer.citation.providedCitationUrl', outputLabel: 'citationUrl' },
            { dataLabel: 'answer.citation.confidenceRating', outputLabel: 'confidenceRating' },
            { dataLabel: 'answer.englishAnswer', outputLabel: 'englishAnswer' },
            { dataLabel: 'answer.content', outputLabel: 'answer' },
            { dataLabel: 'answer.sentences.0', outputLabel: 'sentence1' },
            { dataLabel: 'answer.sentences.1', outputLabel: 'sentence2' },
            { dataLabel: 'answer.sentences.2', outputLabel: 'sentence3' },
            { dataLabel: 'answer.sentences.3', outputLabel: 'sentence4' },
            { dataLabel: 'expertFeedback.feedback', outputLabel: 'feedback' },
            { dataLabel: 'expertFeedback.totalScore', outputLabel: 'expertFeedback.totalScore' },
            { dataLabel: 'expertFeedback.sentence1Score', outputLabel: 'expertFeedback.sentence1Score' },
            { dataLabel: 'expertFeedback.sentence1Explanation', outputLabel: 'expertFeedback.sentence1Explanation' },
            { dataLabel: 'expertFeedback.sentence1Harmful', outputLabel: 'expertFeedback.sentence1Harmful' },
            { dataLabel: 'expertFeedback.sentence2Score', outputLabel: 'expertFeedback.sentence2Score' },
            { dataLabel: 'expertFeedback.sentence2Explanation', outputLabel: 'expertFeedback.sentence2Explanation' },
            { dataLabel: 'expertFeedback.sentence2Harmful', outputLabel: 'expertFeedback.sentence2Harmful' },
            { dataLabel: 'expertFeedback.sentence3Score', outputLabel: 'expertFeedback.sentence3Score' },
            { dataLabel: 'expertFeedback.sentence3Explanation', outputLabel: 'expertFeedback.sentence3Explanation' },
            { dataLabel: 'expertFeedback.sentence3Harmful', outputLabel: 'expertFeedback.sentence3Harmful' },
            { dataLabel: 'expertFeedback.sentence4Score', outputLabel: 'expertFeedback.sentence4Score' },
            { dataLabel: 'expertFeedback.sentence4Explanation', outputLabel: 'expertFeedback.sentence4Explanation' },
            { dataLabel: 'expertFeedback.sentence4Harmful', outputLabel: 'expertFeedback.sentence4Harmful' },
            { dataLabel: 'expertFeedback.citationScore', outputLabel: 'expertFeedback.citationScore' },
            { dataLabel: 'expertFeedback.citationExplanation', outputLabel: 'expertFeedback.citationExplanation' },
            { dataLabel: 'expertFeedback.answerImprovement', outputLabel: 'expertFeedback.answerImprovement' },
            { dataLabel: 'expertFeedback.expertCitationUrl', outputLabel: 'expertFeedback.expertCitationUrl' },
            { dataLabel: 'downloadStartLogs', outputLabel: 'startedDownloads' },
            { dataLabel: 'downloadCompleteLogs', outputLabel: 'completedDownloads' }
        ];
        const type = filename.endsWith('.csv') ? 'csv' : filename.endsWith('.xlsx') ? 'xlsx' : 'xlsx';
        return ExportService.toSpreadsheet(items, headerOrder, type, filename);
    },

};
export default ExportService;
