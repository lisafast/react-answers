// src/pages/HomePage.js
import React from 'react';
import TempChatAppContainer from '../components/chat/TempChatAppContainer';
import { GcdsContainer, GcdsDetails, GcdsText, GcdsLink } from '@cdssnc/gcds-components-react';

const HomePage = () => {
  return (
    <>
      <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600" chat-app-wrapper>
        <h1 className='mb-400'>AI Answers</h1>
        <h2 className='mt-400 mb-400'>Get answers to your Canada.ca questions. </h2>
        <GcdsText className='mb-400'> This proof of concept is for research purposes only. Work is ongoing.
        </GcdsText>
        <GcdsDetails detailsTitle='About AI Answers' className='mb-400'>
          <GcdsText >To protect your privacy, numbers and addresses will be removed before your question is sent to the AI service.  The removed text will display as <strong>XXX</strong>. </GcdsText>
          <GcdsText>AI service Claude: Anthropic Claude Sonnet 3.5, knowledge to April 2024</GcdsText>
          <GcdsText>AI service ChatGPT: OpenAI 4o,  knowledge to May 2024</GcdsText>
          <GcdsText><GcdsLink href="https://github.com/lisafast/react-answers/blob/main/src/services/systemPrompt.js">Read the System Prompt</GcdsLink> that controls the AI output.  </GcdsText>
          <GcdsText>Development is still in progress - contact lisa.fast@cds-snc.ca for information. </GcdsText>
          <GcdsLink href="/admin">Admin options
          </GcdsLink>
        </GcdsDetails>
        <TempChatAppContainer />
      </GcdsContainer>
      <GcdsContainer size="sm" centered className="mb-600">
        <GcdsText>Help improve this service:<a href="https://cdssnc.qualtrics.com/jfe/form/SV_4N2YTcAHkcBEGfs" className="feedback-survey-link" target="_blank" rel="noopener noreferrer">take the user survey </a></GcdsText> 
        <GcdsDetails detailsTitle='Privacy and AI terms of use' className='mb-400'>
          <GcdsText>
            We may store your questions and answers to improve system performance. Personal information will be deleted and replaced with XXX. Personal information won't be stored.
          </GcdsText>
          <GcdsText>
            Use the Canada.ca link provided in the response to check your answer. Responses generated by this AI system should not be considered as professional, legal, or medical
            advice. We attempt to ensure the accuracy
            of the information provided but there is a possibility that the information may contain
            inaccuracies, and the information may not yet reflect recent changes or fulfill your particular
            needs or purposes.
          </GcdsText>
          <GcdsText>
            This AI system relies on information provided on Government of Canada websites and your use of this system
            and any information generated is also subject to the <GcdsLink
              href="https://www.canada.ca/en/transparency/terms.html">Canada.ca Terms and conditions.</GcdsLink>
          </GcdsText>
        </GcdsDetails>
      </GcdsContainer>
    </>
  );
};

export default HomePage;