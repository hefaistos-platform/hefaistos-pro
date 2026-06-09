import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './index.css';
import App from './App';
import { PlaybookMetaProvider } from './context/PlaybookMetaContext';
import reportWebVitals from './reportWebVitals';
import { ApolloProvider } from '@apollo/client/react'; // CORRECTED IMPORT PATH
import client from './apollo-client';
import { ConfigProvider, theme, App as AntdApp } from 'antd';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            colorLink: '#1677ff',
            borderRadius: 8,
            colorBgLayout: '#f5f8fc',
          },
          components: {
            Card: {
              headerBg: '#e6f2ff',
              padding: 16,
            },
            Tag: {
              defaultBg: '#e6f4ff',
              defaultColor: '#0958d9'
            },
          }
        }}
      >
        <AntdApp>
          <PlaybookMetaProvider>
            <App />
          </PlaybookMetaProvider>
        </AntdApp>
      </ConfigProvider>
    </ApolloProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
