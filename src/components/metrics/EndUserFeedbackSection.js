import React from 'react';
import { GcdsText } from '@cdssnc/gcds-components-react';
import DataTable from 'datatables.net-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EndUserFeedbackSection = ({ t, metrics }) => {
  return (
    <div className="mb-600">
      <h3 className="mb-300">{t('metrics.dashboard.userScored.title')} / Public Feedback</h3>
      <GcdsText className="mb-300">{t('metrics.dashboard.userScored.description')}</GcdsText>
      <div className="bg-gray-50 p-4 rounded-lg">
        <DataTable
          data={[
            {
              metric: t('metrics.dashboard.userScored.total'),
              count: metrics.userScored.total.total,
              percentage: '100%',
              enCount: metrics.userScored.total.en,
              enPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.total.en / metrics.userScored.total.total) * 100) + '%' : '0%',
              frCount: metrics.userScored.total.fr,
              frPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.total.fr / metrics.userScored.total.total) * 100) + '%' : '0%'
            },
            {
              metric: t('metrics.dashboard.userScored.helpful'),
              count: metrics.userScored.helpful.total,
              percentage: metrics.userScored.total.total ? Math.round((metrics.userScored.helpful.total / metrics.userScored.total.total) * 100) + '%' : '0%',
              enCount: metrics.userScored.helpful.en,
              enPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.helpful.en / metrics.userScored.total.total) * 100) + '%' : '0%',
              frCount: metrics.userScored.helpful.fr,
              frPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.helpful.fr / metrics.userScored.total.total) * 100) + '%' : '0%'
            },
            {
              metric: t('metrics.dashboard.userScored.unhelpful'),
              count: metrics.userScored.unhelpful.total,
              percentage: metrics.userScored.total.total ? Math.round((metrics.userScored.unhelpful.total / metrics.userScored.total.total) * 100) + '%' : '0%',
              enCount: metrics.userScored.unhelpful.en,
              enPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.unhelpful.en / metrics.userScored.total.total) * 100) + '%' : '0%',
              frCount: metrics.userScored.unhelpful.fr,
              frPercentage: metrics.userScored.total.total ? Math.round((metrics.userScored.unhelpful.fr / metrics.userScored.total.total) * 100) + '%' : '0%'
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
            info: false
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '2rem' }}>
          {/* Pie chart for YES (helpful) reasons */}
          <div style={{ flex: 1, minWidth: 300, height: 300 }}>
            <h4>Helpful (Yes) - Reason Breakdown</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.publicFeedbackReasons)
                    .filter(([reason, _]) => reason && reason.toLowerCase() !== 'other' && reason !== '' && reason !== undefined && reason !== null && reason !== 'undefined' && reason !== 'null')
                    .map(([reason, count]) => {
                      // Map reason to translation key
                      const yesReasonMap = {
                        "I don't need to call the government": 'homepage.publicFeedback.yes.options.noCall',
                        "I don't need to visit an office": 'homepage.publicFeedback.yes.options.noVisit',
                        "Saved me time searching and reading": 'homepage.publicFeedback.yes.options.savedTime',
                        "Other - please fill out the survey": 'homepage.publicFeedback.yes.options.other'
                      };
                      if (yesReasonMap[reason]) {
                        return { name: t(yesReasonMap[reason]), value: count };
                      }
                      return null;
                    })
                    .filter(Boolean)
                  }
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {Object.entries(metrics.publicFeedbackReasons)
                    .filter(([reason, _]) => {
                      const yesReasonMap = {
                        "I don't need to call the government": 'homepage.publicFeedback.yes.options.noCall',
                        "I don't need to visit an office": 'homepage.publicFeedback.yes.options.noVisit',
                        "Saved me time searching and reading": 'homepage.publicFeedback.yes.options.savedTime',
                        "Other - please fill out the survey": 'homepage.publicFeedback.yes.options.other'
                      };
                      return yesReasonMap[reason];
                    })
                    .map((entry, idx) => (
                      <Cell key={`cell-yes-${idx}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042"][idx % 4]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Pie chart for NO (unhelpful) reasons */}
          <div style={{ flex: 1, minWidth: 300, height: 300 }}>
            <h4>Unhelpful (No) - Reason Breakdown</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.publicFeedbackReasons)
                    .filter(([reason, _]) => reason && reason.toLowerCase() !== 'other' && reason !== '' && reason !== undefined && reason !== null && reason !== 'undefined' && reason !== 'null')
                    .map(([reason, count]) => {
                      // Map reason to translation key
                      const noReasonMap = {
                        'Irrelevant or off topic': 'homepage.publicFeedback.no.options.irrelevant',
                        'Too complex or confusing': 'homepage.publicFeedback.no.options.confusing',
                        'Not detailed enough': 'homepage.publicFeedback.no.options.notDetailed',
                        'Answer is clear, but is not what I wanted to hear': 'homepage.publicFeedback.no.options.notWanted',
                        'Other - please fill out the survey': 'homepage.publicFeedback.no.options.other'
                      };
                      if (noReasonMap[reason]) {
                        return { name: t(noReasonMap[reason]), value: count };
                      }
                      return null;
                    })
                    .filter(Boolean)
                  }
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {Object.entries(metrics.publicFeedbackReasons)
                    .filter(([reason, _]) => {
                      const noReasonMap = {
                        'Irrelevant or off topic': 'homepage.publicFeedback.no.options.irrelevant',
                        'Too complex or confusing': 'homepage.publicFeedback.no.options.confusing',
                        'Not detailed enough': 'homepage.publicFeedback.no.options.notDetailed',
                        'Answer is clear, but is not what I wanted to hear': 'homepage.publicFeedback.no.options.notWanted',
                        'Other - please fill out the survey': 'homepage.publicFeedback.no.options.other'
                      };
                      return noReasonMap[reason];
                    })
                    .map((entry, idx) => (
                      <Cell key={`cell-no-${idx}`} fill={["#8884d8", "#FF8042", "#FFBB28", "#00C49F"][idx % 4]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Table for public feedback reasons breakdown by language */}
        <div style={{ marginTop: '2rem' }}>
          <h4>{t('metrics.dashboard.userScored.reasonTableTitle') || 'Public Feedback Reasons Breakdown'}</h4>
          <DataTable
            data={(() => {
              // Prepare breakdown by reason and language
              const yesReasonMap = {
                "I don't need to call the government": 'homepage.publicFeedback.yes.options.noCall',
                "I don't need to visit an office": 'homepage.publicFeedback.yes.options.noVisit',
                "Saved me time searching and reading": 'homepage.publicFeedback.yes.options.savedTime',
                "Other - please fill out the survey": 'homepage.publicFeedback.yes.options.other'
              };
              const noReasonMap = {
                'Irrelevant or off topic': 'homepage.publicFeedback.no.options.irrelevant',
                'Too complex or confusing': 'homepage.publicFeedback.no.options.confusing',
                'Not detailed enough': 'homepage.publicFeedback.no.options.notDetailed',
                'Answer is clear, but is not what I wanted to hear': 'homepage.publicFeedback.no.options.notWanted',
                'Other - please fill out the survey': 'homepage.publicFeedback.no.options.other'
              };
              const allReasons = Array.from(new Set([
                ...Object.keys(metrics.publicFeedbackReasons),
                ...Object.keys(yesReasonMap),
                ...Object.keys(noReasonMap)
              ])).filter(
                r => r && r !== '' && r !== undefined && r !== null && r !== 'undefined' && r !== 'null'
              );
              // Calculate total for each language
              const totalEn = metrics.userScored?.total?.en || 0;
              const totalFr = metrics.userScored?.total?.fr || 0;
              // Assume metrics.publicFeedbackReasonsByLang exists, else fallback to all in 'en'
              const reasonsByLang = metrics.publicFeedbackReasonsByLang || {};
              return allReasons.map(reason => {
                const enCount = reasonsByLang.en?.[reason] || 0;
                const frCount = reasonsByLang.fr?.[reason] || 0;
                // Use translation key if available
                const label = yesReasonMap[reason]
                  ? t(yesReasonMap[reason])
                  : noReasonMap[reason]
                  ? t(noReasonMap[reason])
                  : reason;
                return {
                  reason: label,
                  enCount,
                  enPercentage: totalEn ? Math.round((enCount / totalEn) * 100) + '%' : '0%',
                  frCount,
                  frPercentage: totalFr ? Math.round((frCount / totalFr) * 100) + '%' : '0%',
                  total: enCount + frCount,
                  totalPercentage: (totalEn + totalFr) ? Math.round(((enCount + frCount) / (totalEn + totalFr)) * 100) + '%' : '0%'
                };
              }).filter(row => row.total > 0);
            })()}
            columns={[
              { title: t('metrics.dashboard.count'), data: 'total' },
              { title: t('metrics.dashboard.percentage'), data: 'totalPercentage' },
              { title: t('metrics.dashboard.userScored.reason'), data: 'reason' },
              { title: t('metrics.dashboard.enCount'), data: 'enCount' },
              { title: t('metrics.dashboard.enPercentage'), data: 'enPercentage' },
              { title: t('metrics.dashboard.frCount'), data: 'frCount' },
              { title: t('metrics.dashboard.frPercentage'), data: 'frPercentage' }
            ]}
            options={{
              paging: false,
              searching: false,
              ordering: false,
              info: false
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default EndUserFeedbackSection;
