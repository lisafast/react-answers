import React from 'react';
import { GcdsText } from '@cdssnc/gcds-components-react';
import DataTable from 'datatables.net-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EndUserFeedbackSection = ({ t, metrics }) => {
  return (
    <div className="mb-600">
      <h3 className="mb-300">{t('metrics.dashboard.userScored.title')} / Public Feedback</h3>
      <GcdsText className="mb-300">{t('metrics.dashboard.userScored.description')} Breakdown of public (end-user) feedback by reason and score.</GcdsText>
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
                      // Only include reasons for helpful/yes (score 1-4)
                      const yesReasons = [
                        "I don't need to call the government",
                        "I don't need to visit an office",
                        "Saved me time searching and reading",
                        "Other - please fill out the survey"
                      ];
                      if (yesReasons.includes(reason)) {
                        return { name: reason, value: count };
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
                      const yesReasons = [
                        "I don't need to call the government",
                        "I don't need to visit an office",
                        "Saved me time searching and reading",
                        "Other - please fill out the survey"
                      ];
                      return yesReasons.includes(reason);
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
                      // Only include reasons for unhelpful/no (score 5-9)
                      const noReasons = [
                        'Irrelevant or off topic',
                        'Too complex or confusing',
                        'Not detailed enough',
                        'Answer is clear, but is not what I wanted to hear',
                        'Other - please fill out the survey'
                      ];
                      if (noReasons.includes(reason)) {
                        return { name: reason, value: count };
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
                      const noReasons = [
                        'Irrelevant or off topic',
                        'Too complex or confusing',
                        'Not detailed enough',
                        'Answer is clear, but is not what I wanted to hear',
                        'Other - please fill out the survey'
                      ];
                      return noReasons.includes(reason);
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
      </div>
    </div>
  );
};

export default EndUserFeedbackSection;
