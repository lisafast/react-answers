import React, { useState } from 'react';
import { GcdsButton, GcdsContainer, GcdsText } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import DataStoreService from '../../services/DataStoreService.js';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import ExportService from '../../services/ExportService.js';
import { useTranslations } from '../../hooks/useTranslations.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import EndUserFeedbackSection from '../metrics/EndUserFeedbackSection.js';

DataTable.use(DT);

const MetricsDashboard = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [timeRange, setTimeRange] = useState('7');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await DataStoreService.getChatLogs({ days: timeRange });
      if (data.success) {
        // Process the logs to calculate metrics
        const processedMetrics = processMetrics(data.logs || []);
        setMetrics(processedMetrics);
      } else {
        console.error('API returned error:', data.error);
        alert(data.error || 'Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      alert(`Failed to fetch metrics: ${error.message}`);
    }
    setLoading(false);
  };

  const processMetrics = (logs) => {
    // Use a local Set to track unique chatIds
    const uniqueChatIds = new Set();
    // Track unique chatIds by language
    const uniqueChatIdsEn = new Set();
    const uniqueChatIdsFr = new Set();
    // Initialize metrics object
    const metrics = {
      totalSessions: logs.length,
      totalQuestions: 0,
      totalQuestionsEn: 0,
      totalQuestionsFr: 0,
      totalConversations: 0,
      totalConversationsEn: 0,
      totalConversationsFr: 0,
      totalOutputTokens: 0,
      totalOutputTokensEn: 0,
      totalOutputTokensFr: 0,
      sessionsByQuestionCount: {
        singleQuestion: { total: 0, en: 0, fr: 0 },
        twoQuestions: { total: 0, en: 0, fr: 0 },
        threeQuestions: { total: 0, en: 0, fr: 0 }
      },
      answerTypes: {
        normal: { total: 0, en: 0, fr: 0 },
        'clarifying-question': { total: 0, en: 0, fr: 0 },
        'pt-muni': { total: 0, en: 0, fr: 0 },
        'not-gc': { total: 0, en: 0, fr: 0 }
      },
      expertScored: {
        total: { total: 0, en: 0, fr: 0 },
        correct: { total: 0, en: 0, fr: 0 },
        needsImprovement: { total: 0, en: 0, fr: 0 },
        hasError: { total: 0, en: 0, fr: 0 },
        harmful: { total: 0, en: 0, fr: 0 }
      },
      userScored: {
        total: { total: 0, en: 0, fr: 0 },
        helpful: { total: 0, en: 0, fr: 0 },
        unhelpful: { total: 0, en: 0, fr: 0 }
      },
      aiScored: {
        total: { total: 0, en: 0, fr: 0 },
        correct: { total: 0, en: 0, fr: 0 },
        needsImprovement: { total: 0, en: 0, fr: 0 },
        hasError: { total: 0, en: 0, fr: 0 }
      },
      byDepartment: {},
      publicFeedbackReasons: {},
      publicFeedbackScores: {},
      publicFeedbackReasonsByLang: { en: {}, fr: {} }
    };

    // Process each chat document
    logs.forEach(chat => {
      // Track unique chatIds from the chat document
      if (chat.chatId) {
        uniqueChatIds.add(chat.chatId);
        if (chat.pageLanguage === 'en') uniqueChatIdsEn.add(chat.chatId);
        if (chat.pageLanguage === 'fr') uniqueChatIdsFr.add(chat.chatId);
      }

      // Count questions for this session
      const questionCount = chat.interactions?.length || 0;
      const pageLanguage = chat.pageLanguage || 'en';
      
      if (questionCount === 1) {
        metrics.sessionsByQuestionCount.singleQuestion.total++;
        if (pageLanguage === 'en') metrics.sessionsByQuestionCount.singleQuestion.en++;
        if (pageLanguage === 'fr') metrics.sessionsByQuestionCount.singleQuestion.fr++;
      } else if (questionCount === 2) {
        metrics.sessionsByQuestionCount.twoQuestions.total++;
        if (pageLanguage === 'en') metrics.sessionsByQuestionCount.twoQuestions.en++;
        if (pageLanguage === 'fr') metrics.sessionsByQuestionCount.twoQuestions.fr++;
      } else if (questionCount === 3) {
        metrics.sessionsByQuestionCount.threeQuestions.total++;
        if (pageLanguage === 'en') metrics.sessionsByQuestionCount.threeQuestions.en++;
        if (pageLanguage === 'fr') metrics.sessionsByQuestionCount.threeQuestions.fr++;
      }

      // Process each interaction in the chat
      chat.interactions?.forEach(interaction => {
        // Count total questions
        metrics.totalQuestions++;
        if (pageLanguage === 'en') metrics.totalQuestionsEn++;
        if (pageLanguage === 'fr') metrics.totalQuestionsFr++;
        
        // Count output tokens
        const tokens = Number(interaction.context?.outputTokens);
        if (!isNaN(tokens)) {
          metrics.totalOutputTokens += tokens;
          if (pageLanguage === 'en') metrics.totalOutputTokensEn += tokens;
          if (pageLanguage === 'fr') metrics.totalOutputTokensFr += tokens;
        }
        
        // Count answer types (per language)
        if (interaction.answer?.answerType) {
          const answerType = interaction.answer.answerType;
          if (Object.prototype.hasOwnProperty.call(metrics.answerTypes, answerType)) {
            metrics.answerTypes[answerType].total++;
            if (pageLanguage === 'en') metrics.answerTypes[answerType].en++;
            if (pageLanguage === 'fr') metrics.answerTypes[answerType].fr++;
          }
        }
        
        // Get department
        const department = interaction.context?.department || 'Unknown';
        
        // Initialize department metrics if not exists
        if (!metrics.byDepartment[department]) {
          metrics.byDepartment[department] = {
            total: 0,
            expertScored: {
              total: 0,
              correct: 0,
              needsImprovement: 0,
              hasError: 0
            },
            userScored: {
              total: 0,
              helpful: 0,
              unhelpful: 0
            }
          };
        }

        // Increment department total
        metrics.byDepartment[department].total++;

        // Process human- and user-scored metrics (per language)
        if (interaction.expertFeedback?.type) {
          const type = interaction.expertFeedback.type;
          if (type === 'expert' && interaction.expertFeedback?.totalScore !== undefined) {
            const score = interaction.expertFeedback.totalScore;
            metrics.expertScored.total.total++;
            if (pageLanguage === 'en') metrics.expertScored.total.en++;
            if (pageLanguage === 'fr') metrics.expertScored.total.fr++;
            metrics.byDepartment[department].expertScored.total++;
            
            // Check for harmful content in any sentence
            const isHarmful = ['sentence1Harmful', 'sentence2Harmful', 'sentence3Harmful', 'sentence4Harmful', 'sentence5Harmful']
              .some(field => interaction.expertFeedback[field] === true);
            
            if (isHarmful) {
              metrics.expertScored.harmful.total++;
              if (pageLanguage === 'en') metrics.expertScored.harmful.en++;
              if (pageLanguage === 'fr') metrics.expertScored.harmful.fr++;
            }
            
            if (score === 100) {
              metrics.expertScored.correct.total++;
              if (pageLanguage === 'en') metrics.expertScored.correct.en++;
              if (pageLanguage === 'fr') metrics.expertScored.correct.fr++;
              metrics.byDepartment[department].expertScored.correct++;
            } else if (score >= 82 && score <= 99) {
              metrics.expertScored.needsImprovement.total++;
              if (pageLanguage === 'en') metrics.expertScored.needsImprovement.en++;
              if (pageLanguage === 'fr') metrics.expertScored.needsImprovement.fr++;
              metrics.byDepartment[department].expertScored.needsImprovement++;
            } else {
              metrics.expertScored.hasError.total++;
              if (pageLanguage === 'en') metrics.expertScored.hasError.en++;
              if (pageLanguage === 'fr') metrics.expertScored.hasError.fr++;
              metrics.byDepartment[department].expertScored.hasError++;
            }
          } else if (type === 'public' && interaction.expertFeedback?.publicFeedbackScore !== undefined) {
            metrics.userScored.total.total++;
            if (pageLanguage === 'en') metrics.userScored.total.en++;
            if (pageLanguage === 'fr') metrics.userScored.total.fr++;
            metrics.byDepartment[department].userScored.total++;
            const publicScore = interaction.expertFeedback.publicFeedbackScore;
            if (publicScore <= 5) {
              metrics.userScored.helpful.total++;
              if (pageLanguage === 'en') metrics.userScored.helpful.en++;
              if (pageLanguage === 'fr') metrics.userScored.helpful.fr++;
              metrics.byDepartment[department].userScored.helpful++;
            } else {
              metrics.userScored.unhelpful.total++;
              if (pageLanguage === 'en') metrics.userScored.unhelpful.en++;
              if (pageLanguage === 'fr') metrics.userScored.unhelpful.fr++;
              metrics.byDepartment[department].userScored.unhelpful++;
            }
          }
        }

        // Process AI-scored metrics (per language)
        if (interaction.autoEval?.expertFeedback?.totalScore !== undefined) {
          metrics.aiScored.total.total++;
          if (pageLanguage === 'en') metrics.aiScored.total.en++;
          if (pageLanguage === 'fr') metrics.aiScored.total.fr++;
          const score = interaction.autoEval.expertFeedback.totalScore;
          if (score === 100) {
            metrics.aiScored.correct.total++;
            if (pageLanguage === 'en') metrics.aiScored.correct.en++;
            if (pageLanguage === 'fr') metrics.aiScored.correct.fr++;
          } else if (score >= 82 && score <= 99) {
            metrics.aiScored.needsImprovement.total++;
            if (pageLanguage === 'en') metrics.aiScored.needsImprovement.en++;
            if (pageLanguage === 'fr') metrics.aiScored.needsImprovement.fr++;
          } else {
            metrics.aiScored.hasError.total++;
            if (pageLanguage === 'en') metrics.aiScored.hasError.en++;
            if (pageLanguage === 'fr') metrics.aiScored.hasError.fr++;
          }
        }
      });
    });

    // Set the totalConversations as the number of unique chatIds
    metrics.totalConversations = uniqueChatIds.size;
    metrics.totalConversationsEn = uniqueChatIdsEn.size;
    metrics.totalConversationsFr = uniqueChatIdsFr.size;

    // Add to metrics: publicFeedback breakdown by reason and score
    const publicFeedbackReasons = {};
    const publicFeedbackScores = {};
    const publicFeedbackReasonsByLang = { en: {}, fr: {} };
    logs.forEach(chat => {
      chat.interactions?.forEach(interaction => {
        if (interaction.expertFeedback?.type === 'public') {
          const reason = interaction.expertFeedback.publicFeedbackReason || 'Other';
          const score = interaction.expertFeedback.publicFeedbackScore || 'Other';
          publicFeedbackReasons[reason] = (publicFeedbackReasons[reason] || 0) + 1;
          publicFeedbackScores[score] = (publicFeedbackScores[score] || 0) + 1;
          const lang = chat.pageLanguage === 'fr' ? 'fr' : 'en';
          publicFeedbackReasonsByLang[lang][reason] = (publicFeedbackReasonsByLang[lang][reason] || 0) + 1;
        }
      });
    });
    metrics.publicFeedbackReasons = publicFeedbackReasons;
    metrics.publicFeedbackScores = publicFeedbackScores;
    metrics.publicFeedbackReasonsByLang = publicFeedbackReasonsByLang;

    return metrics;
  };

  // Commenting out export functions for now
  /*
  const filename = (ext) => {
    let name = 'metrics-' + timeRange + '-' + new Date().toISOString();
    return name + '.' + ext;
  };

  const downloadJSON = () => {
    const json = JSON.stringify(metrics, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename('json');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    ExportService.export(metrics, filename('csv'));
  };

  const downloadExcel = () => {
    ExportService.export(metrics, filename('xlsx'));
  };
  */

  return (
    <GcdsContainer size="xl" className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 mb-1">
            Time range
          </label>
          <select
            id="timeRange"
            name="timeRange"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="1">Last 1 day</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        <GcdsButton
          onClick={fetchMetrics}
          disabled={loading}
          className="me-400 hydrated mrgn-tp-1r"
        >
          {loading ? 'Loading...' : 'Get metrics'}
        </GcdsButton>

        {/* Commenting out export buttons for now
        {metrics.totalSessions > 0 && (
          <>
            <GcdsButton
              onClick={downloadJSON}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download JSON
            </GcdsButton>

            <GcdsButton
              onClick={downloadCSV}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download CSV
            </GcdsButton>
            <GcdsButton
              onClick={downloadExcel}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download Excel
            </GcdsButton>
          </>
        )}
        */}
      </div>

      <GcdsContainer size="xl" className="bg-white shadow rounded-lg mb-600">
        {loading ? (
          <div className="p-4">
            <GcdsText>Loading metrics...</GcdsText>
          </div>
        ) : metrics.totalSessions > 0 ? (
          <div className="p-4">
            <h2 className="mt-400 mb-400">{t('metrics.dashboard.title')}</h2>
            <div>
              <h3 className="mb-300">{t('metrics.dashboard.usageMetrics')}</h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-600">
                {/* TODO: Add a department filter */}
                <DataTable
                  data={[
                    {
                      metric: t('metrics.dashboard.totalSessions'),
                      count: metrics.totalConversations,
                      percentage: '100%',
                      enCount: metrics.totalConversationsEn,
                      enPercentage: metrics.totalConversations ? Math.round((metrics.totalConversationsEn / metrics.totalConversations) * 100) + '%' : '0%',
                      frCount: metrics.totalConversationsFr,
                      frPercentage: metrics.totalConversations ? Math.round((metrics.totalConversationsFr / metrics.totalConversations) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.outputTokens'),
                      count: metrics.totalOutputTokens,
                      percentage: '100%',
                      enCount: metrics.totalOutputTokensEn,
                      enPercentage: metrics.totalOutputTokens ? Math.round((metrics.totalOutputTokensEn / metrics.totalOutputTokens) * 100) + '%' : '0%',
                      frCount: metrics.totalOutputTokensFr,
                      frPercentage: metrics.totalOutputTokens ? Math.round((metrics.totalOutputTokensFr / metrics.totalOutputTokens) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.totalQuestions'),
                      count: metrics.totalQuestions,
                      percentage: metrics.totalConversations ? Math.round((metrics.totalQuestions / metrics.totalConversations) * 100) + '%' : '0%',
                      enCount: metrics.totalQuestionsEn,
                      enPercentage: metrics.totalQuestions ? Math.round((metrics.totalQuestionsEn / metrics.totalQuestions) * 100) + '%' : '0%',
                      frCount: metrics.totalQuestionsFr,
                      frPercentage: metrics.totalQuestions ? Math.round((metrics.totalQuestionsFr / metrics.totalQuestions) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.sessionsByQuestionCount.singleQuestion'),
                      count: metrics.sessionsByQuestionCount.singleQuestion.total,
                      percentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.singleQuestion.total / metrics.totalConversations) * 100) + '%' : '0%',
                      enCount: metrics.sessionsByQuestionCount.singleQuestion.en,
                      enPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.singleQuestion.en / metrics.totalConversations) * 100) + '%' : '0%',
                      frCount: metrics.sessionsByQuestionCount.singleQuestion.fr,
                      frPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.singleQuestion.fr / metrics.totalConversations) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.sessionsByQuestionCount.twoQuestions'),
                      count: metrics.sessionsByQuestionCount.twoQuestions.total,
                      percentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.twoQuestions.total / metrics.totalConversations) * 100) + '%' : '0%',
                      enCount: metrics.sessionsByQuestionCount.twoQuestions.en,
                      enPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.twoQuestions.en / metrics.totalConversations) * 100) + '%' : '0%',
                      frCount: metrics.sessionsByQuestionCount.twoQuestions.fr,
                      frPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.twoQuestions.fr / metrics.totalConversations) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.sessionsByQuestionCount.threeQuestions'),
                      count: metrics.sessionsByQuestionCount.threeQuestions.total,
                      percentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.threeQuestions.total / metrics.totalConversations) * 100) + '%' : '0%',
                      enCount: metrics.sessionsByQuestionCount.threeQuestions.en,
                      enPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.threeQuestions.en / metrics.totalConversations) * 100) + '%' : '0%',
                      frCount: metrics.sessionsByQuestionCount.threeQuestions.fr,
                      frPercentage: metrics.totalConversations ? Math.round((metrics.sessionsByQuestionCount.threeQuestions.fr / metrics.totalConversations) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.answerTypes.normal'),
                      count: metrics.answerTypes.normal.total,
                      percentage: metrics.totalQuestions ? Math.round((metrics.answerTypes.normal.total / metrics.totalQuestions) * 100) + '%' : '0%',
                      enCount: metrics.answerTypes.normal.en,
                      enPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes.normal.en / metrics.totalQuestions) * 100) + '%' : '0%',
                      frCount: metrics.answerTypes.normal.fr,
                      frPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes.normal.fr / metrics.totalQuestions) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.answerTypes.clarifyingQuestion'),
                      count: metrics.answerTypes['clarifying-question'].total,
                      percentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['clarifying-question'].total / metrics.totalQuestions) * 100) + '%' : '0%',
                      enCount: metrics.answerTypes['clarifying-question'].en,
                      enPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['clarifying-question'].en / metrics.totalQuestions) * 100) + '%' : '0%',
                      frCount: metrics.answerTypes['clarifying-question'].fr,
                      frPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['clarifying-question'].fr / metrics.totalQuestions) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.answerTypes.ptMuni'),
                      count: metrics.answerTypes['pt-muni'].total,
                      percentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['pt-muni'].total / metrics.totalQuestions) * 100) + '%' : '0%',
                      enCount: metrics.answerTypes['pt-muni'].en,
                      enPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['pt-muni'].en / metrics.totalQuestions) * 100) + '%' : '0%',
                      frCount: metrics.answerTypes['pt-muni'].fr,
                      frPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['pt-muni'].fr / metrics.totalQuestions) * 100) + '%' : '0%'
                    },
                    {
                      metric: t('metrics.dashboard.answerTypes.notGc'),
                      count: metrics.answerTypes['not-gc'].total,
                      percentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['not-gc'].total / metrics.totalQuestions) * 100) + '%' : '0%',
                      enCount: metrics.answerTypes['not-gc'].en,
                      enPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['not-gc'].en / metrics.totalQuestions) * 100) + '%' : '0%',
                      frCount: metrics.answerTypes['not-gc'].fr,
                      frPercentage: metrics.totalQuestions ? Math.round((metrics.answerTypes['not-gc'].fr / metrics.totalQuestions) * 100) + '%' : '0%'
                    }
                  ]}
                  columns={[
                    { title: t('metrics.dashboard.metric'), data: 'metric' },
                    { title: t('metrics.dashboard.count'), data: 'count' },
                    { title: t('metrics.dashboard.percentage'), data: 'percentage' },
                    { title: t('metrics.dashboard.enCount'), data: 'enCount' },
                    { title: t('metrics.dashboard.enPercentage'), data: 'enPercentage' },
                    { title: t('metrics.dashboard.frCount'), data: 'frCount' },
                    { title: t('metrics.dashboard.frPercentage'), data: 'frPercentage' }
                  ]}
                  options={{
                    paging: false,
                    searching: false,
                    ordering: false,
                    info: false,
                    stripe: true,
                    className: 'display'
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-600">
                <h3 className="mb-300">{t('metrics.dashboard.expertScored.title')}</h3>
                <GcdsText className="mb-300">{t('metrics.dashboard.expertScored.description')}</GcdsText>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <DataTable
                    data={[
                      {
                        metric: t('metrics.dashboard.expertScored.total'),
                        count: metrics.expertScored.total.total,
                        percentage: '100%',
                        enCount: metrics.expertScored.total.en,
                        enPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.total.en / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.expertScored.total.fr,
                        frPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.total.fr / metrics.expertScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.expertScored.correct'),
                        count: metrics.expertScored.correct.total,
                        percentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.correct.total / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.expertScored.correct.en,
                        enPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.correct.en / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.expertScored.correct.fr,
                        frPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.correct.fr / metrics.expertScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.expertScored.needsImprovement'),
                        count: metrics.expertScored.needsImprovement.total,
                        percentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.needsImprovement.total / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.expertScored.needsImprovement.en,
                        enPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.needsImprovement.en / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.expertScored.needsImprovement.fr,
                        frPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.needsImprovement.fr / metrics.expertScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.expertScored.hasError'),
                        count: metrics.expertScored.hasError.total,
                        percentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.hasError.total / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.expertScored.hasError.en,
                        enPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.hasError.en / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.expertScored.hasError.fr,
                        frPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.hasError.fr / metrics.expertScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.expertScored.harmful'),
                        count: metrics.expertScored.harmful.total,
                        percentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.harmful.total / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.expertScored.harmful.en,
                        enPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.harmful.en / metrics.expertScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.expertScored.harmful.fr,
                        frPercentage: metrics.expertScored.total.total ? Math.round((metrics.expertScored.harmful.fr / metrics.expertScored.total.total) * 100) + '%' : '0%'
                      }
                    ]}
                    columns={[
                      { title: t('metrics.dashboard.metric'), data: 'metric' },
                      { title: t('metrics.dashboard.count'), data: 'count' },
                      { title: t('metrics.dashboard.percentage'), data: 'percentage' },
                      { title: t('metrics.dashboard.enCount'), data: 'enCount' },
                      { title: t('metrics.dashboard.enPercentage'), data: 'enPercentage' },
                      { title: t('metrics.dashboard.frCount'), data: 'frCount' },
                      { title: t('metrics.dashboard.frPercentage'), data: 'frPercentage' }
                    ]}
                    options={{
                      paging: false,
                      searching: false,
                      ordering: false,
                      info: false,
                      stripe: true,
                      className: 'display'
                    }}
                  />
                </div>
              </div>
              <div className="mb-600">
                <h3 className="mb-300">{t('metrics.dashboard.aiScored.title')}</h3>
                <GcdsText className="mb-300">{t('metrics.dashboard.aiScored.description')}</GcdsText>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <DataTable
                    data={[
                      {
                        metric: t('metrics.dashboard.aiScored.total'),
                        count: metrics.aiScored.total.total,
                        percentage: '100%',
                        enCount: metrics.aiScored.total.en,
                        enPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.total.en / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.aiScored.total.fr,
                        frPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.total.fr / metrics.aiScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.aiScored.correct'),
                        count: metrics.aiScored.correct.total,
                        percentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.correct.total / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.aiScored.correct.en,
                        enPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.correct.en / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.aiScored.correct.fr,
                        frPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.correct.fr / metrics.aiScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.aiScored.needsImprovement'),
                        count: metrics.aiScored.needsImprovement.total,
                        percentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.needsImprovement.total / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.aiScored.needsImprovement.en,
                        enPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.needsImprovement.en / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.aiScored.needsImprovement.fr,
                        frPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.needsImprovement.fr / metrics.aiScored.total.total) * 100) + '%' : '0%'
                      },
                      {
                        metric: t('metrics.dashboard.aiScored.hasError'),
                        count: metrics.aiScored.hasError.total,
                        percentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.hasError.total / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        enCount: metrics.aiScored.hasError.en,
                        enPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.hasError.en / metrics.aiScored.total.total) * 100) + '%' : '0%',
                        frCount: metrics.aiScored.hasError.fr,
                        frPercentage: metrics.aiScored.total.total ? Math.round((metrics.aiScored.hasError.fr / metrics.aiScored.total.total) * 100) + '%' : '0%'
                      }
                    ]}
                    columns={[
                      { title: t('metrics.dashboard.metric'), data: 'metric' },
                      { title: t('metrics.dashboard.count'), data: 'count' },
                      { title: t('metrics.dashboard.percentage'), data: 'percentage' },
                      { title: t('metrics.dashboard.enCount'), data: 'enCount' },
                      { title: t('metrics.dashboard.enPercentage'), data: 'enPercentage' },
                      { title: t('metrics.dashboard.frCount'), data: 'frCount' },
                      { title: t('metrics.dashboard.frPercentage'), data: 'frPercentage' }
                    ]}
                    options={{
                      paging: false,
                      searching: false,
                      ordering: false,
                      info: false,
                      stripe: true,
                      className: 'display'
                    }}
                  />
                </div>
              </div>
            </div>
      

            <EndUserFeedbackSection t={t} metrics={metrics} />
            <div className="bg-gray-50 p-4 rounded-lg mb-600">
              <h3 className="mb-300">{t('metrics.dashboard.byDepartment.title')}</h3>
              <DataTable
                data={Object.entries(metrics.byDepartment).map(([department, data]) => ({
                  department,
                  totalQuestions: data.total,
                  expertScoredTotal: data.expertScored.total,
                  expertScoredCorrect: data.expertScored.correct,
                  expertScoredNeedsImprovement: data.expertScored.needsImprovement,
                  expertScoredHasError: data.expertScored.hasError,
                  expertScoredHasErrorPercent: data.expertScored.total ? Math.round((data.expertScored.hasError / data.expertScored.total) * 100) : 0
                }))}
                columns={[
                  { title: t('metrics.dashboard.byDepartment.title'), data: 'department' },
                  { title: t('metrics.dashboard.byDepartment.totalQuestions'), data: 'totalQuestions' },
                  { title: t('metrics.dashboard.byDepartment.expertTotal'), data: 'expertScoredTotal' },
                  { title: t('metrics.dashboard.expertScored.correct'), data: 'expertScoredCorrect' },
                  { title: t('metrics.dashboard.expertScored.needsImprovement'), data: 'expertScoredNeedsImprovement' },
                  { 
                    title: t('metrics.dashboard.expertScored.hasError'), 
                    data: 'expertScoredHasError',
                    render: (data, type, row) => {
                      if (type === 'display') {
                        return `${data} (${row.expertScoredHasErrorPercent}%)`;
                      }
                      return data;
                    }
                  }
                ]}
                options={{
                  paging: true,
                  pageLength: 25,
                  searching: true,
                  ordering: true,
                  order: [[1, 'desc']],
                  stripe: true,
                  className: 'display'
                }}
              />
            </div>
          </div>
        ) : (
          <div className="p-4">
            <GcdsText>
              Select a time range and click 'Get metrics' to view performance metrics
            </GcdsText>
          </div>
        )}
      </GcdsContainer>
    </GcdsContainer>
  );
};

export default MetricsDashboard;