import React, { useContext } from 'react';
import LessonRecorder from './LessonRecorder';
import SubjectsListView from './SubjectsListView';
import LessonsForSubjectView from './LessonsForSubjectView';
import LessonDetailView from './LessonDetailView';
import { AppContext } from '../App';

const LessonsView: React.FC = () => {
  const {
    lessonView,
    selectedSubject,
    selectedLessonId,
    lessonViewAnimationClass,
    handleSelectSubject,
    handleSelectLesson,
    handleBackToSubjects,
    handleBackToLessons,
  } = useContext(AppContext);

  const renderContent = () => {
      switch (lessonView) {
          case 'detail':
              return <LessonDetailView lessonId={selectedLessonId!} onBack={handleBackToLessons} />;
          case 'lessons':
              return <LessonsForSubjectView subject={selectedSubject!} onBack={handleBackToSubjects} onSelectLesson={handleSelectLesson} />;
          case 'subjects':
          default:
              return <SubjectsListView onSelectSubject={handleSelectSubject} />;
      }
  };

  return (
      <div>
          <LessonRecorder />
          <div className="mt-8">
              <div key={lessonView} className={lessonViewAnimationClass}>
                  {renderContent()}
              </div>
          </div>
      </div>
  );
};

export default LessonsView;