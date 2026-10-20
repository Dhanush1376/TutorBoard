import React from 'react';
import { Container, SectionIntro, useSpy } from './kit';
import Pipeline from './Pipeline';

export default function HowItWorksSection() {
  const ref = useSpy('how-it-works');
  return (
    <section id="how-it-works" ref={ref} className="relative">
      <SectionIntro
        index="01"
        label="How it works"
        title="From a question"
        muted="to a picture you can think with."
        lede="AI explains in paragraphs. TutorBoard plans and draws a live interactive lesson."
      />

      <Container className="pb-24 lg:pb-36">
        <Pipeline />
      </Container>
    </section>
  );
}
