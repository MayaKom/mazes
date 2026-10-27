// Consent form, exactly as provided (the text inside textScreen('Consent form', `...`)).
// experiment.html shows it under the heading "Consent form", with the buttons
// "I do NOT consent" and "I consent".
const CONSENT_TITLE = "Consent form";
const CONSENT_HTML = `
        <p class="gw-meta"><strong>Study Title:</strong> Online studies of causal cognition<br>
        <strong>Researcher:</strong> Elizabeth Bonawitz, Ph.D</p>

        <p>Dear Participants,</p>

        <h3>Key Information</h3>
        <p>The following is a short summary of this study to help you decide whether or not to be a part of this study. More detailed information is listed later on in this form.</p>

        <h4>Why am I being invited to take part in a research study?</h4>
        <p>We invite you to take part in a research study because you are among the eligible participants for this study, which includes adults age 18 or older.</p>

        <h4>What should I know about a research study?</h4>
        <ul>
          <li>The research study will be explained to you via online instructions or survey information.</li>
          <li>Whether or not you take part is up to you.</li>
          <li>Your participation is completely voluntary.</li>
          <li>You can choose not to take part.</li>
          <li>You can agree to take part and later change your mind.</li>
          <li>Your decision will not be held against you.</li>
          <li>Your refusal to participate will not result in any consequences or any loss of benefits that you are otherwise entitled to receive.</li>
          <li>You can ask all the questions you want before you decide.</li>
        </ul>

        <h4>Why is this research being done?</h4>
        <p>The purpose of this research is to understand how people are able to learn from their interactions with objects, events, and other people. We are currently studying individuals' learning and development in multiple domains, including causal, visual, language and memory.</p>

        <h4>How long will the research last and what will I need to do?</h4>
        <p>This session will take approximately 20 minutes (including filling out this consent form).</p>
        <p>During the self-guided session, you may be presented with objects or images or watch a video clip and answer questions. There are no "right or wrong" responses to any of these questions—we simply want to find out how people approach objects and situations. Please note that you are NOT being evaluated academically or psychologically, we are simply conducting basic research.</p>

        <h4>Is there any way being in this study could be bad for me?</h4>
        <p>We don't believe there are any risks from participating in this research.</p>

        <h4>Will being in this study help me in any way?</h4>
        <p>There are no benefits to you from your taking part in this research. We cannot promise any benefits to others from your taking part in this research. However, possible benefits to others include furthering the field's understanding of cognitive development.</p>

        <h3>Detailed Information</h3>
        <p>The following is more detailed information about this study in addition to the information listed above.</p>

        <h4>What is the purpose of this research?</h4>
        <p>This research asks four specific questions in learning: (1) How do evidence and prior beliefs interact in children's causal learning? (2) What are the early developmental origins of construing and understanding events? (3) What are learning algorithms that include appropriate cognitive developmental constraints? (4) What is the role of social information in learning? This research examines the cognitive components and learning systems underlying the development and structure of both the response and detection of novel stimuli and the formation and revision of causal belief in humans across the lifespan and how these experiences may change reasoning.</p>

        <h4>What happens if I say yes, but I change my mind later?</h4>
        <p>You can leave the research at any time; it will not be held against you. If you wish to stop, we will end the session without penalty.</p>

        <h4>Audio/Video Recording</h4>
        <p>We will NOT video and/or audio record the session.</p>

        <h4>If I take part in this research, how will my privacy be protected? What happens to the information you collect?</h4>
        <p>Efforts will be made to limit the use and disclosure of your Personal Information, including research participation and information on this form, to people who have a need to review this information. We cannot promise complete secrecy. Organizations that may inspect and copy your information include the IRB and other representatives of this organization. If identifiers are removed from your identifiable private information that is collected during this research, that information could be used for future research studies or distributed to another investigator for future research studies without your additional informed consent.</p>

        <h4>Can I be removed from the research without my OK?</h4>
        <p>The person in charge of the research study or the sponsor can remove you from the research study without your approval. Possible reasons for removal include instances when the participant does not meet the eligibility criteria for the study, which may be determined by their responses to one or more of our questions during the research.</p>

        <h4>What else do I need to know?</h4>
        <p>This research is being funded by the Templeton Foundation, the Caplan Foundation for Early Childhood, NSF, the James F. McDonnell Foundation, the Jacobs Foundation, and funds awarded to Elizabeth Bonawitz from the Harvard Graduate School of Education and the Mind, Brain, and Behavior initiative at Harvard.</p>

        <h4>Compensation</h4>
        <p>If you agree to take part in this research study, you will receive compensation for your time and effort. Amazon Mechanical Turk and Prolific participants will be compensated through their respective platforms.</p>

        <h4>Who can I talk to?</h4>
        <p>If you have questions, concerns, or complaints, you can contact our Principal Investigator, Dr. Elizabeth Bonawitz [<a href="mailto:elizabeth_bonawitz@gse.harvard.edu">elizabeth_bonawitz@gse.harvard.edu</a>].</p>
        <p>This research has been reviewed and approved by the Harvard University Area Institutional Review Board ("IRB"). You may talk to them at (617) 496-2847 or <a href="mailto:cuhs@harvard.edu">cuhs@harvard.edu</a> if:</p>
        <ul>
          <li>Your questions, concerns, or complaints are not being answered by the research team.</li>
          <li>You cannot reach the research team.</li>
          <li>You want to talk to someone besides the research team.</li>
          <li>You have questions about your rights as a research subject.</li>
          <li>You want to get information or provide input about this research.</li>
        </ul>`;
