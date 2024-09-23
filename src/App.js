/* eslint-disable no-unused-vars */
/* eslint-disable import/no-unused-modules */
import React from 'react';
import TempChatAppContainer from './components/chat/TempChatAppContainer';

function App() {
  return (
    <div className="App">
      <header>
      </header>
      <main>
      <h1>AI Answers</h1>
  <h2>Get answers to your Canada.ca questions. </h2>
			<p>To protect your privacy, names, numbers and addresses aren't accepted and will display as
				an <strong>X</strong>. Learn more
				at <a href="https://test.canada.ca/wayfinding-orientation-2023/ai/answers.html">About AI Answers</a>
			</p>
      <TempChatAppContainer />
      </main>
    </div>
  );
}

export default App;

