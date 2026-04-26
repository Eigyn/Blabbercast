# Blabbercast — License & Disclaimer

## MIT License

Copyright (c) 2026 Eigyn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Disclaimer — Use at Your Own Risk

By using Blabbercast, you acknowledge and agree to the following:

1. **No warranty.** This software is provided "as is" without warranty of any
   kind. The authors make no guarantees regarding reliability, accuracy,
   availability, or fitness for any particular purpose.

2. **Third-party services.** Blabbercast can optionally connect to third-party
   services including but not limited to Twitch (via IRC), YouTube (via web
   scraping), and Microsoft Edge TTS (via Azure endpoints). These services are
   governed by their own terms of service. It is your responsibility to ensure
   your use complies with those terms. The authors of Blabbercast are not
   responsible for changes, restrictions, or actions taken by these third
   parties.

3. **Content responsibility.** Blabbercast reads chat messages aloud. You are
   solely responsible for the content that is spoken on your stream. While
   filtering tools are provided (blocked words, cooldowns, message length
   limits), no filter is perfect. The authors are not liable for any
   offensive, harmful, or inappropriate content that may be read aloud.

4. **Use at your own discretion.** You assume all risk associated with the
   use of this software. This includes but is not limited to: violation of
   platform terms of service, exposure to harmful content, audio disruptions
   during live broadcasts, and any consequences resulting from the use or
   misuse of this software.

5. **No liability.** In no event shall the authors or contributors be held
   liable for any damages, losses, or consequences arising from the use of
   this software, whether direct, indirect, incidental, or consequential.

6. **YouTube scraping notice.** The YouTube chat integration uses unofficial
   methods to read live chat messages. This functionality is not endorsed by
   or affiliated with YouTube or Google. It may stop working at any time if
   YouTube changes their systems. Use of this feature may be subject to
   YouTube's Terms of Service.

7. **Edge TTS notice.** The neural voice synthesis feature uses Microsoft's
   Edge TTS service. This is not an officially supported API for third-party
   applications. Use of this feature may be subject to Microsoft's Terms of
   Service.

8. **Piper TTS.** Local neural voice synthesis is provided by Piper TTS, an
   open-source project licensed under the MIT License. Voice models may have
   their own licenses. Check model documentation for details.

## Third-Party Dependency Licenses

Blabbercast's own source code is MIT-licensed. Third-party dependencies keep
their own licenses and notices. If you redistribute bundled runtimes,
`node_modules`, Python packages, Piper binaries, or voice models, include the
corresponding third-party license files and comply with their terms.

Notable Python TTS dependencies checked during release prep include:

- `edge-tts`: LGPLv3 for most files; one bundled SRT composer file is MIT.
- `pyttsx3`: MPL-2.0.
- `certifi`: MPL-2.0.
- `pywin32`: PSF license.
- `pypiwin32`: package metadata reports `UNKNOWN`; inspect before bundling.
