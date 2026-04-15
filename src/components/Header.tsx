import { APP, SOCIAL } from '../constants/app';
import './Header.css';

export const Header = () => {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-branding">
          <div className="logo-container">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="app-logo"
              aria-hidden="true"
            >
              <rect
                x="2"
                y="2"
                width="28"
                height="28"
                rx="4"
                fill="currentColor"
                className="logo-bg"
              />
              <path
                d="M8 16C8 16 12 12 16 12C20 12 24 16 24 16"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="swing-arc"
              />
              <circle cx="16" cy="16" r="2" fill="white" className="golf-ball" />
            </svg>
          </div>
          <div className="app-title">
            <h1 className="app-name">
              {APP.short} | {APP.name}
            </h1>
            <p className="app-tagline">{APP.tagline}</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="share-btn"
            onClick={() => {
              // Future: implement share functionality
              console.log(`Share ${SOCIAL.hashtag} ${SOCIAL.handle}`);
            }}
            aria-label="Share your golf room"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 8C16.1046 8 17 7.10457 17 6C17 4.89543 16.1046 4 15 4C13.8954 4 13 4.89543 13 6C13 6.55228 13.2239 7.05228 13.5858 7.41421L7.41421 13.5858C7.05228 13.2239 6.55228 13 6 13C4.89543 13 4 13.8954 4 15C4 16.1046 4.89543 17 6 17C7.10457 17 8 16.1046 8 15C8 14.4477 7.77614 13.9477 7.41421 13.5858L13.5858 7.41421C13.9477 7.77614 14.4477 8 15 8Z"
                fill="currentColor"
              />
            </svg>
            <span className="share-text">Share</span>
          </button>
        </div>
      </div>
      
      {/* Room-like grid background pattern */}
      <div className="header-grid-bg" aria-hidden="true"></div>
    </header>
  );
};
