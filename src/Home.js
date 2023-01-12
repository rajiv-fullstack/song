import React, { useState, useEffect } from "react";
import { Link, Redirect } from "react-router-dom";
import { throttle, debounce } from "throttle-debounce";
// import { Waypoint } from "react-waypoint";
import copy from "copy-to-clipboard";
import { cachedFetch } from "./Cache";
import Countdown from "react-countdown";
import CountdownTimer from "./CountdownTimer";
import Bannertop from "./Bannertop";
import pics from "./songs_desktop.png";
import mobileimgs from "./songs_mobile.png";
import {
  Loading,
  SetHTMLHeaders,
  ResetHTMLHeaders,
  isServer,
  // YouTubeSnippetIntersectionLazy,
  loadCarbonScript,
  AmazonRelatedProducts,
  RenderParagraphs
} from "./Common";
import { SongComments } from "./Comments";
import { ShowRecentComments } from "./RecentComments";

// if (process.env.PUBLIC_URL === undefined) {
//   // console.error("process.env.PUBLIC_URL should not be undefined");
//   throw new Error("process.env.PUBLIC_URL should not be undefined");
// }
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const lazyloadThumbnailImage = PUBLIC_URL + "/static/lazyload-thumbnail.png";
const placeholderImage = PUBLIC_URL + "/static/placeholder.png";

const NO_ADS = process.env.REACT_APP_NO_ADS === "true";

const samplePlaceholders = [
  "Born to be wild",
  "No one ever told me life was kind",
  "But here it comes again, straight thru the heart",
  "I'm an alligator",
  "My mouth, it moves"
];
samplePlaceholders.sort(() => 0.5 - Math.random());

const appendSuggestion = (text, append) => {
  let split = text.split(/\s+/);
  split.pop();
  split.push(append);
  return split.join(" ");
};

const Completionist = () => <span>You are good to go!</span>;
const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;
const NOW_IN_MS = new Date().getTime();

const dateTimeAfterThreeDays = NOW_IN_MS + THREE_DAYS_IN_MS;

class Home extends React.Component {
  constructor(props) {
    super(props);

    let q = "";
    let originalQ = "";
    let artistName = "";
    let total = 0;
    let searchResults = null;
    let desperate = false;
    let missing = null;
    // let suggestions = null;
    let by_name = null;
    let by_name_total = null;
    let by_name_limit = null;
    let searchLanguage = "";
    let searchYear = "";
    let parentSearch = null;
    let keyPhrases = null;
    let popularityFactor = null;
    let searchExample = null;

    const { results } = this.props;

    if (results) {
      this.searched = results.searched;

      q = results.search;
      total = results.total;
      searchResults = results.results;
      desperate = results.desperate;
      missing = results.missing;
      by_name = results.by_name || null;
      by_name_total = results.by_name_total || null;
      by_name_limit = results.by_name_limit || null;
      artistName = results.artist;
      originalQ = results.original || "";
      searchLanguage = results.language || "";
      searchYear = results.year || "";
      parentSearch = results.searched || null;
      keyPhrases = results.key_phrases || null;
      popularityFactor = results.popularityFactor || null;
      searchExample = results.search_example || null;
    }
    let advancedSearch = Boolean(artistName || searchLanguage || searchYear);

    let searchExamples = null;
    let showExamples = false;
    if (props.searchExamples && props.searchExamples.examples) {
      searchExamples = props.searchExamples.examples;
      showExamples = true;
    }

    let recentComments = null;
    let showRecentComments = false;
    if (
      props.recentComments &&
      props.recentComments.comments &&
      props.recentComments.comments.length
    ) {
      recentComments = props.recentComments;
      showRecentComments = true;
    }

    this.state = {
      q,
      originalQ,
      artistName,
      searching: false,
      searchError: null,
      total,
      results: searchResults,
      resultsPageIndex: 0,
      by_name,
      by_name_total,
      by_name_limit,
      placeholder: samplePlaceholders[0],
      slowSearch: null,
      showExamples,
      searchExamples,
      parentSearch,
      desperateSearch: desperate,
      missing,
      keyPhrases,
      popularityFactor,
      searchExample,
      showRecentComments,
      recentComments,

      onlyResults: null,

      searchMaxLength: null,

      autocompleteSuggestions: null,
      autocompleteSearchSuggestions: null,
      autocompleteHighlight: -1,
      showAutocompleteSuggestions: true,

      autocompleteArtistSuggestions: null,
      autocompleteArtistHighlight: -1,
      showAutocompleteArtistSuggestions: true,

      advancedSearch,
      searchLanguage,
      searchLanguages: [],
      searchYear,
      searchYears: [],

      redirectTo: null,
      shareSearch: false
    };

    // When you've typed something longer.
    // If you steadily type something every 100ms for a long time
    // without pausing, this won't fire till you stop.
    this.fetchAutocompleteSuggestionsDebounced = debounce(
      800,
      this.fetchAutocompleteSuggestions
    );
    this.fetchAutocompleteSuggestionsDebouncedLong = debounce(
      1800,
      this.fetchAutocompleteSuggestions
    );

    // When you've started typing.
    // Will basically fire without being postponed.
    this.fetchAutocompleteSuggestionsThrottled = throttle(
      1100,
      this.fetchAutocompleteSuggestions
    );

    this._autocompleteSuggestionsCache = {};
  }

  artistRef = React.createRef();
  languageRef = React.createRef();
  searchRef = React.createRef();

  componentDidMount() {
    ResetHTMLHeaders();
    if (this.props.match.params.q) {
      this.startSearchFromLocation(this.props);
    } else {
      this.startSamplePlaceholderInterval();
      if (!this.state.searchExamples) {
        this.fetchSearchExamples();
      }
      if (!this.state.recentComments) {
        this.fetchRecentComments();
      }
    }
    if (this.state.results) {
      if (
        (this.state.desperateSearch || !this.state.total) &&
        this.state.q.length > 10
      ) {
        this._fetchSearchAlternatives();
      }
    }
  }

  startSearchFromLocation = (props) => {
    const { match } = props;
    const q = decodeURIComponent(match.params.q);

    const sp = new URLSearchParams(props.location.search || "");
    let artist = sp.get("artist");
    let language = sp.get("language");
    let year = sp.get("year");
    let searchExample = sp.get("example");

    // XXX should this compare artist and language too?
    if (this.state.q !== q) {
      const stateUpdate = {
        q
      };
      if (q.length > this.searchRef.current.maxLength - 10) {
        stateUpdate.searchMaxLength = [
          q.length,
          this.searchRef.current.maxLength
        ];
      }

      if (language || year) {
        this.loadSearchAggregates();
        stateUpdate.advancedSearch = true;
      }
      if (language) {
        stateUpdate.searchLanguage = language;
      }
      if (year) {
        stateUpdate.searchYear = year;
      }
      if (artist) {
        stateUpdate.artistName = artist;
        stateUpdate.advancedSearch = true;
      }
      if (searchExample) {
        stateUpdate.searchExample = searchExample;
      }
      this.setState(stateUpdate, () => {
        this.startSearch(
          q,
          language,
          year,
          artist,
          this.state.resultsPageIndex,
          this.state.searchExample
        );
      });
    } else {
      SetHTMLHeaders({
        title: `${q} - Song Search`
      });
    }
  };

  componentDidUpdate(prevProps) {
    if (this.props.match.params.q !== prevProps.match.params.q) {
      if (!this.props.match.params.q) {
        ResetHTMLHeaders();
        this.setState({
          q: "",
          originalQ: "",
          artistName: "",
          searching: false,
          total: null,
          results: null,
          resultsPageIndex: 0,
          slowSearch: null,
          showExamples: false,
          searchExamples: null,
          showRecentComments: false,
          parentSearch: null,
          desperateSearch: false,
          searchExample: null,
          missing: null,
          searchError: null,
          by_name: null,
          by_name_total: null,
          by_name_limit: null,
          autocompleteSuggestions: null,
          autocompleteSearchSuggestions: null,
          autocompleteHighlight: -1,
          autocompleteArtistSuggestions: null,
          autocompleteArtistHighlight: -1,
          redirectTo: null,
          shareSearch: false
        });
        // this.refs.q.value = "";
        this.fetchSearchExamples();
      } else if (
        decodeURIComponent(this.props.match.params.q) !== this.state.q
      ) {
        this.startSearchFromLocation(this.props);
      }
    }
  }

  componentWillUnmount() {
    this.dismounted = true;
    this.stopSamplePlaceholderInterval();
    if (this.fillerInterval) {
      window.clearInterval(this.fillerInterval);
    }
    if (this.slowSearchTimer) {
      window.clearTimeout(this.slowSearchTimer);
    }
  }

  fetchSearchExamples() {
    let url = "/api/search/examples";
    return fetch(url).then((r) => {
      if (r.status === 200) {
        return r.json().then((results) => {
          if (this.dismounted) {
            return;
          }
          if (results) {
            if (!this.state.results && !this.state.searching) {
              this.setState({
                searchExamples: results.examples,
                showExamples: true
              });
            }
          }
        });
      }
    });
  }

  fetchRecentComments() {
    let url = "/api/comments/recent/home";
    return fetch(url).then((r) => {
      if (r.status === 200) {
        return r.json().then((results) => {
          if (this.dismounted) {
            return;
          }
          if (results) {
            if (!this.state.results && !this.state.searching) {
              this.setState({
                recentComments: results,
                showRecentComments: true
              });
            }
          }
        });
      }
    });
  }

  stopSamplePlaceholderInterval() {
    if (this.placeholderSampleInterval) {
      window.clearInterval(this.placeholderSampleInterval);
    }
  }

  startSamplePlaceholderInterval() {
    if (this.state.q) {
      return;
    }
    // let el = document.querySelector('input[type="search"]')
    // if (!el || el.value) return
    this.currentPlaceholder = 0;
    if (this.placeholderSampleInterval) {
      window.clearInterval(this.placeholderSampleInterval);
    }
    this.placeholderSampleInterval = window.setInterval(() => {
      this.setNextSamplePlaceholder();
    }, 3000);
  }

  setNextSamplePlaceholder() {
    if (this.fillerInterval) {
      window.clearInterval(this.fillerInterval);
    }
    const placeholder =
      samplePlaceholders[++this.currentPlaceholder % samplePlaceholders.length];
    const el = this.searchRef.current;
    if (!el) return;
    let slice = 0;
    this.fillerInterval = setInterval(() => {
      if (!placeholder) {
        // something's gone wrong
        return;
      }
      el.placeholder = placeholder.substring(0, ++slice);
      if (slice >= placeholder.length) {
        clearInterval(this.fillerInterval);
        el.placeholder += "...";
      }
    }, 10);
  }

  onFocusSearch = () => {
    this.searchRef.current.placeholder = "";
    clearInterval(this.placeholderSampleInterval);
    if (this.fillerInterval) {
      clearInterval(this.fillerInterval);
    }
    if (!this.state.showAutocompleteSuggestions) {
      this.setState({ showAutocompleteSuggestions: true });
    }
    if (this.state.shareSearch) {
      this.setState({ shareSearch: false });
    }

    if (!this._firstFocusSearch) {
      this._firstFocusSearch = true;
      // If you're on a small screen this is the first time you've focused,
      // the scroll the top of the search input into view.
      if (window.innerHeight && window.innerHeight < 600) {
        this.searchRef.current.scrollIntoView();
      }
    }
  };

  onBlurSearch = (event) => {
    if (!this.state.q) {
      this.setNextSamplePlaceholder();
      this.startSamplePlaceholderInterval();
    }
    setTimeout(() => {
      if (!this.dismounted) {
        this.setState({
          showAutocompleteSuggestions: false
        });
      }
    }, 300);
  };

  onFocusArtist = (event) => {
    if (!this.state.showAutocompleteArtistSuggestions) {
      this.setState({ showAutocompleteArtistSuggestions: true });
    }
  };

  onBlurArtist = (event) => {
    setTimeout(() => {
      if (!this.dismounted) {
        this.setState({
          showAutocompleteArtistSuggestions: false
        });
      }
    }, 300);
  };

  sampleSearch = (event, search) => {
    event.preventDefault();
    const stateUpdate = { q: search.term, searchExample: search.id };

    if (search.language || search.year) {
      if (
        !this.state.searchLanguages.length ||
        !this.state.searchYears.length
      ) {
        this.loadSearchAggregates();
      }
    }

    if (search.language) {
      stateUpdate.searchLanguage = search.language;
      stateUpdate.advancedSearch = true;
    } else if (this.state.searchLanguage) {
      stateUpdate.searchLanguage = "";
    }

    if (search.year) {
      stateUpdate.searchYear = search.year;
      stateUpdate.advancedSearch = true;
    } else if (this.state.searchYear) {
      stateUpdate.searchYear = "";
    }

    if (search.artist) {
      stateUpdate.artistName = search.artist;
      stateUpdate.advancedSearch = true;
    } else if (this.state.artistName) {
      stateUpdate.artistName = "";
    }

    this.setState(stateUpdate, () => {
      this.submitSearch();
    });
  };

  onSubmit = (event) => {
    event.preventDefault();
    this.submitSearch();
  };

  submitSearch() {
    let q = this.state.q.trim();
    // let language = this.languageRef.current && this.languageRef.current.value;
    // if (!language && this.state.searchLanguage) {
    //   language = this.state.searchLanguage;
    // }
    const language = this.state.searchLanguage;
    const year = this.state.searchYear;

    let artistName =
      this.artistRef.current && this.artistRef.current.value.trim();
    if (!artistName && this.state.artistName) {
      if (!this.state.advancedSearch) {
        artistName = this.state.artistName;
      }
    } else if (artistName && !this.state.artistName) {
      this.setState({ artistName });
    }
    if (q) {
      let newURL = `/q/${encodeURIComponent(q)}`;
      // only include the language= if it's set and not 'en'
      if (language && language !== "en") {
        newURL += `?language=${language}`;
      }
      if (year) {
        newURL += newURL.includes("?") ? "&" : "?";
        newURL += `year=${year}`;
      }
      if (artistName) {
        newURL += newURL.includes("?") ? "&" : "?";
        newURL += `artist=${encodeURIComponent(artistName)}`;
      }
      let currentURL = this.props.location.pathname;
      if (this.props.location.search) {
        currentURL += this.props.location.search;
      }
      if (newURL === currentURL) {
        // get out of here
        return;
      }
      this.props.history.push(newURL);
      this.startSearch(q, language, year, artistName);

      // XXX this.searchRef.current.blur()????
      document.querySelector('input[type="search"]').blur();
      if (this.state.autocompleteSuggestions) {
        this.setState({
          autocompleteSuggestions: null,
          autocompleteSearchSuggestions: null,
          autocompleteHighlight: -1,
          showAutocompleteSuggestions: true
        });
      }
      if (this.state.autocompleteArtistSuggestions) {
        this.setState({
          autocompleteArtistSuggestions: null,
          autocompleteArtistHighlight: -1
        });
      }
    }
  }

  startSearch(
    q,
    language = null,
    year = null,
    artist = null,

    page = 0,
    searchExample = null
  ) {
    SetHTMLHeaders({
      title: "Searching... - Song Search"
    });
    // The state change is quite differnet depend on it being
    // the first page or a subsequent page.
    if (page) {
      this.setState(
        {
          searching: true,
          searchError: null
        },
        () => {
          this.sendSearch(q, language, year, artist, page, searchExample);
        }
      );
    } else {
      this.setState(
        {
          searching: true,
          searchError: null,
          // suggestions: null,
          results: null,
          by_name: null,
          showExamples: false,
          showRecentComments: false,
          parentSearch: null
        },
        () => {
          this.sendSearch(q, language, year, artist, page, searchExample);
          this.slowSearchTimer = window.setTimeout(() => {
            if (!this.state.searchError && !this.state.results) {
              this.setState({ slowSearch: true });
            }
          }, 5 * 1000);
        }
      );
    }
  }

  sendSearch(
    q,
    language = null,
    year = null,
    artist = null,
    page = 0,
    searchExample = null
  ) {
    let url = `/api/search?q=${encodeURIComponent(q)}`;
    if (language) {
      url += `&language=${language}`;
    }
    if (year) {
      url += `&year=${year}`;
    }
    if (artist) {
      url += `&artist=${encodeURIComponent(artist)}`;
    }
    if (page) {
      url += `&page=${page + 1}`;
      url += `&searched=${this.searched}`;
    } else if (this.state.originalQ) {
      url += `&original=${this.searched}`;
    }
    if (this.state.desperateSearch && !this.state.originalQ) {
      url += `&desperate=true`;
    }
    if (searchExample) {
      url += `&example=${searchExample}`;
    }
    return cachedFetch(url).then((r) => {
      if (r.status === 200) {
        return r.json().then((results) => {
          if (this.slowSearchTimer) {
            window.clearTimeout(this.slowSearchTimer);
          }
          if (this.dismounted) {
            return;
          }
          if (!results) {
            return;
          }
          if (results.error) {
            this.setState({
              searchError: results.error,
              searching: false,
              slowSearch: null
            });
            SetHTMLHeaders({
              title: "Sorry, search error"
            });
            return;
          } else if (this.state.searchError) {
            this.setState({ searchError: null });
          }

          SetHTMLHeaders({
            title: `${q} - Song Search`
          });

          // This is the first time sendSearch is called for
          // this q (and this offset).
          // Decide whether to get suggestions searches...
          // console.log(
          //   'Results:', results.results.length,
          //   'Total:', results.total,
          //   'Limit:', results.limit,
          // )

          // set this so that the onExpandClick can use it
          if (!page) {
            this.searched = results.searched;
          }
          // set in localStorage for the sake "Open in a new tab"
          try {
            localStorage.setItem(
              "searched",
              `${results.searched},${new Date().getTime()}`
            );
          } catch (ex) {
            console.warn("'localStorage.setItem(\"searched\")' didn't work");
          }

          let allResults;
          if (page) {
            allResults = [];
            this.state.results.forEach((r) => allResults.push(r));
            results.results.forEach((r) => allResults.push(r));
          } else {
            allResults = results.results;
          }
          this.setState(
            {
              desperateSearch: results.desperate,
              missing: results.missing,
              popularityFactor: results.popularity_factor,
              parentSearch: results.searched,
              searching: false,
              results: allResults,
              keyPhrases: null,
              by_name: results.by_name,
              by_name_total: results.by_name_total,
              by_name_limit: results.by_name_limit,
              total: results.total,
              searchError: null,
              slowSearch: null
            },
            () => {
              if (
                (this.state.desperateSearch || !this.state.total) &&
                this.state.q.length > 10
              ) {
                this._fetchSearchAlternatives();
              }
            }
          );
        });
      } else {
        r.text().then((text) => {
          SetHTMLHeaders({
            title: "Search Error"
          });
          this.setState({
            searching: false,
            searchError: { status: r.status, text: text },
            slowSearch: false
          });
        });
      }
    });
  }

  _fetchSearchAlternatives = () => {
    const url = `/api/search/alternatives?searched=${this.state.parentSearch}`;
    return cachedFetch(url).then((r) => {
      if (r.status === 200) {
        return r.json().then((results) => {
          if (this.dismounted) {
            return;
          }
          if (!results) {
            return;
          }
          this.setState({ keyPhrases: results.key_phrases });
        });
      }
    });
  };

  onChangeSearch = (event) => {
    const q = event.target.value;
    this.setState({ q }, () => {
      if (this.state.desperateSearch) {
        this.setState({ desperateSearch: false });
      }
      if (this.state.originalQ) {
        this.setState({ originalQ: "" });
      }

      let length = q.length;
      if (length > this.searchRef.current.maxLength - 10) {
        this.setState({
          searchMaxLength: [length, this.searchRef.current.maxLength],
          showAutocompleteSuggestions: false
        });
      } else if (this.state.searchMaxLength) {
        this.setState({
          searchMaxLength: null,
          showAutocompleteSuggestions: true
        });
      }

      if (this.state.q.trim()) {
        if (this.autocompleteWaitingFor) {
          if (q.trim() === this.autocompleteWaitingFor) {
            return;
          }
        }
        if ((length < 4 || q.endsWith(" ")) && length < 24) {
          // the impatient one
          this.fetchAutocompleteSuggestionsThrottled(
            q,
            this.state.searchLanguage
          );
        } else if (length > 24) {
          // When what you've typed is really long use the really
          // delayed throttle.
          this.fetchAutocompleteSuggestionsDebouncedLong(
            q,
            this.state.searchLanguage
          );
        } else if (length) {
          this.fetchAutocompleteSuggestionsDebounced(
            q,
            this.state.searchLanguage
          );
        } else {
          this.setState({
            autocompleteSuggestions: null,
            autocompleteSearchSuggestions: null,
            autocompleteHighlight: -1,
            showAutocompleteSuggestions: true
          });
        }
      } else {
        this.setState({
          autocompleteSuggestions: null,
          autocompleteSearchSuggestions: null,
          autocompleteHighlight: -1,
          showAutocompleteSuggestions: true
        });
      }
    });
  };

  fetchAutocompleteSuggestions(q, language = null) {
    let cacheHash = q.trim();
    let url = `/api/search/autocomplete?q=${encodeURIComponent(q)}`;
    if (language) {
      cacheHash += language.trim();
      url += `&language=${language}`;
    }
    const cached = this._autocompleteSuggestionsCache[cacheHash];
    if (cached) {
      return Promise.resolve(cached).then((results) => {
        this.setState({
          autocompleteSuggestions: results.matches,
          autocompleteSearchSuggestions: results.search_suggestions,
          autocompleteHighlight: -1,
          missing: results.missing
        });
      });
    }

    // Store a "global" of what the latest q was.
    this.autocompleteWaitingFor = q;
    return fetch(url).then((r) => {
      if (r.status === 200) {
        return r.json().then((results) => {
          if (this.dismounted) {
            return;
          }
          if (q.startsWith(this.autocompleteWaitingFor)) {
            this._autocompleteSuggestionsCache[cacheHash] = results;
            if (this.state.q) {
              this.setState({
                autocompleteSuggestions: results.matches,
                autocompleteSearchSuggestions: results.search_suggestions,
                autocompleteHighlight: -1
              });
            }
          }
        });
      }
    });
  }

  fetchAutocompleteArtistSuggestions(q) {
    const url = `/api/search/autocomplete?q=${q}&artist=true`;
    return fetch(url)
      .then((r) => {
        if (r.status === 200) {
          return r.json();
        }
      })
      .then((results) => {
        if (this.dismounted) {
          return;
        }
        if (results) {
          this.setState({
            autocompleteArtistSuggestions: results.matches,
            autocompleteArtistHighlight: -1
          });
        }
      });
  }

  onKeyDownSearch = (event) => {
    let suggestions = this.state.autocompleteSuggestions;
    if (suggestions) {
      let highlight = this.state.autocompleteHighlight;
      if (event.key === "Tab") {
        event.preventDefault();
        let suggestion =
          highlight > -1 ? suggestions[highlight] : suggestions[0];
        if (!suggestion._url) {
          this.setState({
            q: suggestion.text + " "
          });
          this.fetchAutocompleteSuggestions(
            suggestion.text,
            this.state.searchLanguage
          );
        }
      } else if (event.key === "ArrowDown" && highlight < suggestions.length) {
        event.preventDefault();
        this.setState({ autocompleteHighlight: highlight + 1 });
      } else if (event.key === "ArrowUp" && highlight > -1) {
        this.setState({ autocompleteHighlight: highlight - 1 });
      } else if (event.key === "Enter") {
        if (highlight > -1) {
          event.preventDefault();
          const searchSuggestions = this.state.autocompleteSearchSuggestions;
          if (highlight === 0 && searchSuggestions && searchSuggestions.total) {
            this.submitSearch();
            return;
          }
          highlight--;
          if (!suggestions[highlight]) {
            // Not sure how this can happen
            console.warn("SUGGESTIONS", suggestions);
            console.warn("HIGHLIGHT", highlight);
            // But bail!
            this.setState(
              {
                autocompleteSuggestions: null,
                autocompleteHighlight: -1
              },
              () => this.submitSearch()
            );
            return;
          }
          if (suggestions[highlight]._url) {
            this.setState({
              redirectTo: {
                pathname: suggestions[highlight]._url
              }
            });
          } else {
            this.setState(
              {
                q: suggestions[highlight].text,
                autocompleteSuggestions: null,
                autocompleteHighlight: -1
              },
              () => this.submitSearch()
            );
          }
        }
      }
    }
  };

  onKeyDownArtistSearch = (event) => {
    let suggestions = this.state.autocompleteArtistSuggestions;
    if (suggestions) {
      let highlight = this.state.autocompleteArtistHighlight;
      if (event.key === "Tab") {
        event.preventDefault();
        if (highlight > -1) {
          this.setState({
            artistName: suggestions[highlight].text
          });
          this.fetchAutocompleteArtistSuggestions(suggestions[highlight].text);
        } else if (suggestions.length) {
          this.setState({
            artistName: suggestions[0].text
          });
          this.fetchAutocompleteArtistSuggestions(suggestions[0].text);
        }
      } else if (event.key === "ArrowDown" && highlight < suggestions.length) {
        event.preventDefault();
        this.setState({ autocompleteArtistHighlight: highlight + 1 });
      } else if (event.key === "ArrowUp" && highlight > -1) {
        this.setState({ autocompleteArtistHighlight: highlight - 1 });
      } else if (event.key === "Enter") {
        if (highlight > -1) {
          event.preventDefault();
          this.setState({
            artistName: suggestions[highlight].text,
            autocompleteArtistSuggestions: null,
            autocompleteArtistHighlight: -1
          });
        }
      }
    }
  };

  toggleShareSearch = (event) => {
    event.preventDefault();
    this.setState({
      shareSearch: !this.state.shareSearch,
      advancedSearch: false
    });
  };

  toggleAdvancedSearch = (event) => {
    event.preventDefault();
    if (!this.state.advancedSearch) {
      // it was not enabled before
      const withCountsLanguages = this.state.searchLanguages.filter(
        (x) => x.count
      );
      const withCountsYears = this.state.searchYears.filter((x) => x.count);
      if (!withCountsLanguages.length || !withCountsYears.length) {
        this.loadSearchAggregates();
      }
    }
    this.setState({
      advancedSearch: !this.state.advancedSearch,
      shareSearch: false
    });
  };

  // loadSearchLanguages() {
  //   return fetch("/api/search/languages").then(r => {
  //     if (r.status === 200) {
  //       r.json().then(r => {
  //         this.setState({ searchLanguages: r.languages });
  //       });
  //     }
  //   });
  // }
  loadSearchAggregates() {
    return fetch("/api/search/aggregates").then((r) => {
      if (r.status === 200) {
        r.json().then((r) => {
          this.setState({ searchLanguages: r.languages, searchYears: r.years });
        });
      }
    });
  }

  onChangeLanguage = (event) => {
    event.preventDefault();
    const searchLanguage = event.target.value;
    this.setState({ searchLanguage });
  };

  onChangeYear = (event) => {
    event.preventDefault();
    const searchYear = event.target.value;
    this.setState({ searchYear });
  };

  onChangeArtistName = (event) => {
    event.preventDefault();
    const artistName = event.target.value;
    this.setState({ artistName }, () => {
      if (artistName.length) {
        this.fetchAutocompleteArtistSuggestions(this.state.artistName.trim());
      } else {
        this.setState({
          autocompleteArtistSuggestions: null,
          autocompleteArtistHighlight: -1
        });
      }
    });
  };

  onSelectSuggestion = (event, suggestion) => {
    event.preventDefault();
    if (suggestion._url) {
      return this.setState({ redirectTo: suggestion._url });
    }
    let newText = suggestion.text;
    if (suggestion.append) {
      newText = appendSuggestion(this.state.q, newText);
    }
    this.setState(
      {
        q: newText,
        autocompleteSuggestions: null,
        autocompleteHighlight: -1
      },
      () => {
        this.submitSearch();
      }
    );
  };

  onSelectSuggestionAll = (event) => {
    event.preventDefault();
    this.submitSearch();
  };

  onSelectArtistSuggestion = (event, suggestion) => {
    event.preventDefault();
    this.setState(
      {
        artistName: suggestion.text,
        autocompleteArtistSuggestions: null,
        autocompleteArtistHighlight: -1
      },
      () => {
        this.submitSearch();
      }
    );
  };

  onLoadMore = (event) => {
    event.preventDefault();
    this.setState(
      {
        resultsPageIndex: this.state.resultsPageIndex + 1
      },
      () => {
        this.startSearch(
          this.state.q,
          this.state.searchLanguage,
          this.state.searchYear,
          this.state.artistName,
          this.state.resultsPageIndex,
          this.state.searchExample
        );
      }
    );
  };

  submitPhrase = (event, keyPhrase) => {
    event.preventDefault();
    const stateUpdate = { q: keyPhrase.phrase, originalQ: this.state.q };
    if (keyPhrase.year) {
      stateUpdate.searchYear = keyPhrase.year;
    }
    if (keyPhrase.language) {
      stateUpdate.searchLanguage = keyPhrase.language;
    }
    this.setState(stateUpdate, () => {
      this.submitSearch();
    });
  };

  reloadSearch = (event) => {
    event.preventDefault();
    window.location.reload();
  };

  loadMoreByName = (event) => {
    const previousByNameLimit = this.state.by_name_limit;
    this.setState(
      {
        by_name_total: 0,
        by_name_limit: 0
      },
      () => {
        const url = `/api/search?q=${encodeURIComponent(
          this.state.q
        )}&by_name=${previousByNameLimit}`;
        fetch(url).then((r) => {
          if (this.dismounted) {
            return;
          }
          if (r.status === 200) {
            r.json().then((results) => {
              if (results) {
                this.setState({
                  by_name: results.by_name,
                  by_name_total: results.by_name_total,
                  by_name_limit: results.by_name_limit
                });
              }
            });
          }
        });
      }
    );
  };

  displayYears = (year) => {
    let yearEnd = year + 9;
    const currentYear = new Date().getFullYear();
    if (yearEnd > currentYear) {
      yearEnd = currentYear;
    }
    return `${year}…${yearEnd}`;
  };

  render() {
    const { redirectTo, searchYear } = this.state;
    if (redirectTo) {
      return <Redirect to={redirectTo} push={true} />;
    }
    let results = null;
    let pagination = null;
    if (this.state.results) {
      let rows = this.state.results;
      if (this.state.onlyResults) {
        let onlyIds = this.state.onlyResults.map((r) => r.id);
        rows = rows.filter((row) => onlyIds.includes(row.id));
      }
      results = (
        <Results
          results={rows}
          searched={this.searched}
          popularityFactor={this.state.popularityFactor}
          showYear={Boolean(searchYear)}
        />
      );
      if (this.state.results.length < this.state.total) {
        pagination = (
          <Pagination
            location={this.props.location}
            page={this.state.resultsPageIndex}
            onLoadMore={this.onLoadMore}
          />
        );
      }
    }

    let byName = null;
    if (this.state.by_name && this.state.by_name.length) {
      byName = (
        <SongsByName
          results={this.state.by_name}
          total={this.state.by_name_total}
          limit={this.state.by_name_limit}
          loadMoreByName={this.loadMoreByName}
        />
      );
    }

    let searchToggles = (
      <span className="help-block toggles">
        {this.state.results && this.state.results.length ? (
          <button
            type="button"
            className={
              this.state.shareSearch
                ? "btn btn-default btn-sm active"
                : "btn btn-default btn-sm"
            }
            onClick={this.toggleShareSearch}
          >
            {this.state.shareSearch
              ? "Hide share search"
              : "Share search results"}
          </button>
        ) : null}
        <button
          type="button"
          className={
            this.state.advancedSearch
              ? "btn btn-default btn-sm active"
              : "btn btn-default btn-sm"
          }
          onClick={this.toggleAdvancedSearch}
        >
          {this.state.advancedSearch ? "Hide search options" : "Search options"}
        </button>
      </span>
    );
    let advancedSearchStatus = null;
    if (!this.state.advancedSearch) {
      let parts = [];
      // if you currently don't have the advanced search options open,
      // show what's currently selected.
      if (this.state.searchLanguage && this.state.searchLanguage !== "en") {
        const language = this.state.searchLanguages.filter((e) => {
          return e.code === this.state.searchLanguage;
        })[0].language;
        parts.push(`Language: ${language}`);
      }

      if (this.state.searchYear) {
        parts.push(
          `Years: ${this.displayYears(parseInt(this.state.searchYear))}`
        );
      }

      if (this.state.artistName) {
        parts.push(`Artist: ${this.state.artistName}`);
      }
      if (parts.length) {
        advancedSearchStatus = (
          <span className="help-block advanced-search-status">
            <b>Search options:</b> {parts.join(", ")}
          </span>
        );
      }
    }

    let advancedInput = null;
    if (this.state.advancedSearch) {
      advancedInput = (
        <div className="advanced">
          <div className="form-group" style={{ position: "relative" }}>
            <input
              type="search"
              ref={this.artistRef}
              value={this.state.artistName}
              className="form-control input-lg"
              maxLength={100}
              onFocus={this.onFocusArtist}
              onBlur={this.onBlurArtist}
              onChange={this.onChangeArtistName}
              onKeyDown={this.onKeyDownArtistSearch}
              aria-label="Artist search"
              placeholder="Artist or band name"
            />
            {this.state.autocompleteArtistSuggestions &&
            this.state.showAutocompleteArtistSuggestions ? (
              <ShowAutocompleteArtistSuggestions
                onSelectSuggestion={this.onSelectArtistSuggestion}
                highlight={this.state.autocompleteArtistHighlight}
                suggestions={this.state.autocompleteArtistSuggestions}
              />
            ) : null}
          </div>
          <div className="form-group">
            <select
              ref={this.languageRef}
              onChange={this.onChangeLanguage}
              value={this.state.searchLanguage}
              className="form-control"
            >
              <option value="">Any language</option>
              {this.state.searchLanguages.map((each) => {
                let text = each.language;
                if (each.count === 1) {
                  text += " (1 song)";
                } else if (each.count) {
                  text += ` (${each.count.toLocaleString()} songs)`;
                }
                return (
                  <option key={each.code} value={each.code}>
                    {text}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group">
            <select
              // ref={this.yearRef}
              onChange={this.onChangeYear}
              value={this.state.searchYear}
              className="form-control"
            >
              <option value="">Any year</option>
              {this.state.searchYears.map((each) => {
                let text = this.displayYears(each.year);
                if (each.count === 1) {
                  text += " (1 song)";
                } else if (each.count) {
                  text += ` (${each.count.toLocaleString()} songs)`;
                }
                return (
                  <option key={text} value={each.year}>
                    {text}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group text-right">
            <button type="submit" className="btn btn-primary">
              Search Now
            </button>
          </div>
        </div>
      );
    }

    let keyPhrases = null;
    if (
      this.state.results &&
      // !this.state.results.length &&
      this.state.keyPhrases &&
      this.state.keyPhrases.length
    ) {
      keyPhrases = (
        <ShowKeyPhrases
          nothingFound={!this.state.results.length}
          phrases={this.state.keyPhrases}
          submitPhrase={this.submitPhrase}
        />
      );
    }

    return (
      <div>
        <form onSubmit={this.onSubmit} action="/api/search/redirect">
          <div className="form-group" style={{ position: "relative" }}>
            <div className="input-group input-group-lg">
              <input
                type="search"
                ref={this.searchRef}
                name="q"
                autoComplete="off"
                value={this.state.q}
                onFocus={this.onFocusSearch}
                onBlur={this.onBlurSearch}
                onChange={this.onChangeSearch}
                onKeyDown={this.onKeyDownSearch}
                className="form-control"
                maxLength={150}
                aria-label="Lyrics search"
                placeholder={this.state.placeholder}
              />
              <span className="input-group-btn">
                <button
                  className="btn btn-default btn-lg"
                  type="submit"
                  title="Click to search"
                >
                  Search
                </button>
              </span>
            </div>
            {this.state.searchMaxLength ? (
              <ShowMaxlengthWarning
                length={this.state.searchMaxLength[0]}
                maxLength={this.state.searchMaxLength[1]}
              />
            ) : null}
            {this.state.desperateSearch &&
            this.state.results &&
            this.state.results.length &&
            !(
              this.state.showAutocompleteSuggestions &&
              this.state.autocompleteSuggestions
            ) ? (
              <ShowDesperateSearchWarning />
            ) : null}
            {!this.state.desperateSearch &&
            this.state.missing &&
            this.state.results &&
            this.state.results.length &&
            !(
              this.state.showAutocompleteSuggestions &&
              this.state.autocompleteSuggestions
            ) ? (
              <ShowMissingSearchWarning missing={this.state.missing} />
            ) : null}
            {this.state.autocompleteSuggestions &&
            this.state.showAutocompleteSuggestions ? (
              <ShowAutocompleteSuggestions
                q={this.state.q}
                onSelectSuggestion={this.onSelectSuggestion}
                onSelectSuggestionAll={this.onSelectSuggestionAll}
                highlight={this.state.autocompleteHighlight}
                suggestions={this.state.autocompleteSuggestions}
                searchSuggestions={this.state.autocompleteSearchSuggestions}
              />
            ) : null}
          </div>
          <ShowResultCount
            results={this.state.results}
            total={this.state.total}
            byName={this.state.by_name}
            onlyResults={this.state.onlyResults}
          />

          {searchToggles}
          {advancedSearchStatus}
          {this.state.shareSearch ? (
            <ShareInput searched={this.searched} />
          ) : null}
          {advancedInput}
        </form>
 
      <div id="waldo-tag-11815">
          <script>
            {`googletag.cmd.push(function() {
              googletag.display = "waldo-tag-11815";
            })`};
          </script>
        </div>

        
        {/* <CountdownTimer targetDate={dateTimeAfterThreeDays} /> */}
        

        {this.state.searchError ? (
          <SearchError error={this.state.searchError} />
        ) : null}
        {this.state.showExamples ? (
          <ShowExamples
            sampleSearch={this.sampleSearch}
            examples={this.state.searchExamples}
          />
        ) : null}
        {this.state.showRecentComments && this.state.recentComments ? (
          <ShowRecentCommentsWrapper
            comments={this.state.recentComments.comments}
          />
        ) : null}
        {/* {suggestions} */}
        {byName}
        {keyPhrases}
        {results}
        {this.state.searching ? <Loading text="Searching..." /> : null}
        {pagination}
        {this.state.slowSearch ? (
          <SlowSearch reloadSearch={this.reloadSearch} />
        ) : null}
      </div>
    );
  }
}

export default Home;

class ShowRecentCommentsWrapper extends React.PureComponent {
  render() {
    const { comments } = this.props;
    return (
      <div className="recent-comments" style={{ marginTop: 50 }}>
        <h4>
          Recent Comments (<Link to="/comments">All</Link>)
        </h4>
        <ShowRecentComments comments={comments} isRoot={true} />
        <div className="load-more">
          <Link to="/comments">More recent comments</Link>
        </div>
      </div>
    );
  }
}

const ShowResultCount = React.memo(
  ({ results, total, onlyResults, byName }) => {
    if (!results) {
      return null;
    }
    let countResults = null;
    if (results) {
      const byNameCount = byName ? byName.length : 0;
      if (onlyResults) {
        countResults = onlyResults.length + byNameCount;
      } else {
        countResults = results.length + byNameCount;
      }
    }
    return (
      <p className="result-metadata text-right">
        <b>
          {total >= 10000 ? "More than " : ""}
          {total.toLocaleString()} {total === 1 ? "song found" : "songs found"}
        </b>{" "}
        {countResults && countResults < total
          ? `(showing ${countResults})`
          : null}
      </p>
    );
  }
);

class ShareInput extends React.PureComponent {
  state = {
    copied: false,
    failed: false,
    hasFocused: false
  };

  absurlRef = React.createRef();

  render() {
    const absoluteUrl = window.location.href;
    return (
      <div className="form-group" style={{ marginTop: 30 }}>
        <div className="input-group">
          <label className="sr-only">URL:</label>
          <input
            ref={this.absurlRef}
            type="text"
            className="form-control"
            readOnly
            value={absoluteUrl}
            onFocus={() => {
              if (!this.state.hasFocused) {
                this.absurlRef.current.select();
                this.setState({ hasFocused: true });
              }
            }}
          />
          <span className="input-group-btn">
            <button
              type="button"
              className={
                this.state.copied ? "btn btn-success" : "btn btn-primary"
              }
              title="Click to copy to clipboard"
              onClick={(event) => {
                event.preventDefault();
                this.absurlRef.current.select();
                if (copy(absoluteUrl)) {
                  this.setState({ copied: true, failed: false }, () => {
                    if (this.props.searched && !this.copied) {
                      this.copied = this.props.searched;
                      fetch(`/api/search/copied/${this.props.searched}`, {
                        method: "POST"
                      });
                    }
                  });
                } else {
                  this.setState({ copied: false, failed: true });
                }
              }}
            >
              {this.state.copied ? "Copied to clipboard" : "Copy to clipboard"}
            </button>
          </span>
        </div>
        {this.state.copied ? (
          <p>
            The URL to this search has now been copied to your clipboard so you
            can paste it anywhere. Thanks!
          </p>
        ) : null}
      </div>
    );
  }
}

const ShowKeyPhrases = React.memo(({ phrases, submitPhrase, nothingFound }) => {
  let subTitle = null;
  if (nothingFound) {
    if (phrases.length === 1) {
      subTitle = <h4>But, try this...</h4>;
    } else {
      subTitle = <h4>But, try these...</h4>;
    }
  }
  return (
    <div className="key-phrases">
      {nothingFound ? (
        <h3>Nothing found</h3>
      ) : (
        <h3>Fuzzy results. Try breaking it up...</h3>
      )}
      {subTitle}
      <table className="table suggestions table-condensed">
        <tbody>
          {phrases.map((phrase) => {
            let url = `/q/${phrase.phrase}`;
            if (phrase.year) {
              url += `?year=${phrase.year}`;
            }
            return (
              <tr key={phrase.phrase}>
                <td>
                  <a href={url} onClick={(e) => submitPhrase(e, phrase)}>
                    {phrase.diff_html ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: phrase.diff_html }}
                      />
                    ) : (
                      phrase.phrase
                    )}
                  </a>
                </td>
                <td>
                  <b>{phrase.total}</b> {phrase.total === 1 ? "song" : "songs"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

const ShowAutocompleteSuggestions = React.memo(
  ({
    q,
    highlight,
    suggestions,
    searchSuggestions,
    onSelectSuggestion,
    onSelectSuggestionAll
  }) => {
    if (!suggestions.length) {
      return null;
    }
    return (
      <div className="autocomplete">
        <ul>
          {searchSuggestions && q && searchSuggestions.total ? (
            <li
              onClick={onSelectSuggestionAll}
              className={
                highlight === 0
                  ? "active search-suggestion"
                  : "search-suggestion"
              }
            >
              {searchSuggestions.capped ? (
                <a
                  style={{ float: "right" }}
                  href={"/q/" + encodeURIComponent(searchSuggestions.term)}
                >
                  {searchSuggestions.total.toLocaleString()}{" "}
                  {searchSuggestions.desperate
                    ? "approximate matches"
                    : "good matches"}
                </a>
              ) : null}
              <a href={"/q/" + encodeURIComponent(searchSuggestions.term)}>
                Search for <i>{q}</i>
              </a>
            </li>
          ) : null}

          {suggestions.map((s, index) => {
            const className = index + 1 === highlight ? "active" : "";
            return (
              <li
                key={s.id ? s.id : s.text}
                className={className}
                onClick={(e) => onSelectSuggestion(e, s)}
              >
                {s.id ? (
                  <ShowAutocompleteSuggestionSong song={s} />
                ) : (
                  <ShowAutocompleteSuggestion
                    text={s.text}
                    html={s.html}
                    found={s.found}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
);

const ShowAutocompleteSuggestion = React.memo(({ found, html }) => {
  if (found) {
    return (
      <p className="search">
        <small>{found}</small>
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </p>
    );
  } else {
    return <p className="search" dangerouslySetInnerHTML={{ __html: html }} />;
  }
});

const ShowAutocompleteSuggestionSong = React.memo(({ song }) => {
  let imageUrl = placeholderImage;
  if (song.image) {
    if (song.image.thumbnail100) {
      imageUrl = song.image.thumbnail100;
    } else {
      imageUrl = song.image.url;
    }
  }
  return (
    <div className="media autocomplete-suggestion-song">
      <div className="media-left">
        <AutocompleteImage url={imageUrl} name={song.name} />
      </div>
      <div className="media-body">
        <h5 className="artist-name">
          <b>{song.name}</b>
          <span className="by">{" by "}</span>
          {song.artist.name}
        </h5>
        {song.fragments.map((fragment, i) => {
          return (
            <p
              key={`${song.id}:${i}`}
              dangerouslySetInnerHTML={{ __html: fragment }}
            />
          );
        })}
      </div>
    </div>
  );
});

const ShowAutocompleteArtistSuggestions = React.memo(
  ({ highlight, suggestions, onSelectSuggestion }) => {
    if (!suggestions.length) {
      return null;
    }
    return (
      <div className="autocomplete">
        <ul>
          {suggestions.map((s, index) => {
            let className = index === highlight ? "active" : "";
            return (
              <li
                key={`${s.text}${index}`}
                className={className}
                onClick={(e) => onSelectSuggestion(e, s)}
              >
                <div className="media">
                  <div className="media-left">
                    <AutocompleteImage
                      url={s.thumbnail100 || s.image || placeholderImage}
                      name={s.text}
                    />
                  </div>
                  <div className="media-body">
                    <h5
                      className="artist-name"
                      dangerouslySetInnerHTML={{ __html: s.html }}
                    />
                    <span className="artist-metadata">
                      {s.songs ? s.songs : "0"} songs
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
);

function ShowMaxlengthWarning({ length, maxLength }) {
  let className = "help-block maxlength";
  if (length === maxLength) {
    className += " danger";
  }
  return (
    <span className={className}>
      {length} of max {maxLength} characters!
    </span>
  );
}

function ShowDesperateSearchWarning() {
  return (
    <span className="help-block warning">
      <b>Note!</b> Nothing could be found with that exact search. Showing fuzzy
      matches.
    </span>
  );
}

function ShowMissingSearchWarning({ missing }) {
  return (
    <span className="help-block warning">
      <b>Note!</b> Results found by discarding{" "}
      <i style={{ textDecoration: "line-through" }}>{missing}</i>.
    </span>
  );
}

const ShowExamples = React.memo(({ sampleSearch, examples }) => {
  return (
    <div className="examples">
      <h4>Successful searches for songs by lyrics</h4>
      <ul>
        {examples.map((search) => {
          let link = "/q/" + encodeURIComponent(search.term);
          link += `?example=${search.id}`;
          if (search.artist) {
            link += `&artist=${encodeURIComponent(search.artist)}`;
          }
          if (search.language) {
            link += `&language=${encodeURIComponent(search.language)}`;
          }
          if (search.year) {
            link += `&year=${search.year}`;
          }
          let searchMeta = null;
          const searchMetaStrings = [];

          if (search.artist) {
            searchMetaStrings.push(["artist", search.artist]);
          }
          if (search.language) {
            searchMetaStrings.push(["language", search.language_human]);
          }
          if (search.year) {
            searchMetaStrings.push(["year", search.year]);
          }
          if (searchMetaStrings.length) {
            searchMeta = (
              <span>
                (
                {searchMetaStrings.map((n, i) => {
                  return (
                    <React.Fragment key={n[0]}>
                      {n[0]} <b>{n[1]}</b>
                      {i + 1 < searchMetaStrings.length ? ", " : ""}
                    </React.Fragment>
                  );
                })}
                )
              </span>
            );
          }

          return (
            <li key={search.id}>
              <Link to={link} onClick={(e) => sampleSearch(e, search)}>
                <b>{search.term}</b>
              </Link>{" "}
              {searchMeta} <i>{search.total_found} found</i>
              <br />
              {search.opened.map((song) => {
                return (
                  <span className="opened" key={song.id}>
                    clicked on{" "}
                    <Link to={song._url}>
                      <b>{song.name}</b> by <b>{song.artist.name}</b>
                    </Link>
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
});

function SlowSearch({ reloadSearch }) {
  return (
    <div className="slow-search">
      <h4>Sorry, search seems to take longer than normal!</h4>
      <p>
        Perhaps it got stuck? <br />
        <button
          type="button"
          className="btn btn-default btn-sm"
          onClick={reloadSearch}
        >
          Reload search
        </button>
      </p>
    </div>
  );
}

function SearchError({ error }) {
  return (
    <div className="search-error">
      <h4>Sorry, an error occured</h4>
      {error.status === 400 ? (
        <p>
          The query was invalid <code>{error.text}</code>
        </p>
      ) : (
        <p>The server basically failed to compute the search</p>
      )}
      {error.status >= 500 && <p>Perhaps simply try again a little later.</p>}
      {error.status >= 500 && (
        <p>
          <button
            type="button"
            className="btn btn-default"
            onClick={(event) => {
              window.location.reload(true);
            }}
          >
            Reload to try again
          </button>
        </p>
      )}
    </div>
  );
}

class Results extends React.PureComponent {
  firstLoad = true;
  componentDidMount() {
    if (!isServer) {
      loadCarbonScript();
    }
    this.firstLoad = false;
  }
  componentDidUpdate(prevProps) {
    // Is this if-statement necessary? I mean, isn't componentDidUpdate
    // something that *only* happens with non-SSR rendering??
    if (!isServer && prevProps.results !== this.props.results) {
      loadCarbonScript();
    }
  }
  render() {
    const { results, searched, popularityFactor, showYear } = this.props;
    return (
      <div>
        {/* This extra span exists to debug if ads are enabled or not */}
        {!NO_ADS ? <div id="carbonadsouter" /> : <span id="_nocardonads" />}

        <div className="results">
          {results.map((result, index) => {
            return (
              <Result
                key={result.id}
                result={result}
                searched={searched}
                expandedByDefault={results.length === 1}
                firstResult={index === 0}
                popularityFactor={popularityFactor}
                firstLoad={this.firstLoad}
                showYear={showYear}
              />
            );
          })}
        </div>
      </div>
    );
  }
}

class Result extends React.PureComponent {
  state = {
    collapsed: true,
    itunes: null,
    amazon: null,
    textHtml: this.props.result.text_html
  };
  affiliateLookupStarted = [];

  componentDidMount() {
    if (this.props.expandedByDefault) {
      this.expand();
    }
  }

  componentWillUnmount() {
    this.dismounted = true;
  }

  onExpandClick = (event) => {
    event.preventDefault();
    this.expand();
  };

  expand() {
    const wasCollapsed = this.state.collapsed;
    this.setState({ collapsed: false });
    this.fetchTextHTML().then(() => {
      if (wasCollapsed) {
        if (this.props.searched) {
          let recordURL = `/api/song/${this.props.result.id}/`;
          recordURL += `expand/${this.props.searched}`;
          fetch(recordURL, { method: "POST" })
            .then((r) => r.json())
            .then((result) => {
              // nothing to do
            });
        }
      }
    });
  }

  fetchTextHTML() {
    if (this.state.textHtml) {
      return Promise.resolve();
    } else {
      const url = `/api/song/${this.props.result.id}?text_only=true`;
      return fetch(url)
        .then((r) => r.json())
        .then((result) => {
          if (this.dismounted) {
            return;
          }
          this.setState({
            textHtml: result.song.text_html
          });
        });
    }
  }

  render() {
    const { result, popularityFactor, firstResult, firstLoad, showYear } =
      this.props;
    let className = "result";
    if (this.state.collapsed) {
      className += " collapsed";
    }
    let songURL = result._url;
    let image;

    if (result.image) {
      image = (
        <SongImage
          url={result.image.url}
          className="pull-right img-thumbnail album"
          name={result.image.name}
          forceLoad={firstResult || !firstLoad}
        />
      );
    } else {
      image = (
        <SongImage
          url={null}
          className="pull-right img-thumbnail"
          name={result.artist.name}
          forceLoad={firstResult || !firstLoad}
        />
      );
    }

    let rest = (
      <p className="read-more">
        <Link to={songURL}>VIEW SONG</Link>{" "}
        <Link to={songURL} onClick={this.onExpandClick}>
          EXPAND SONG
        </Link>
      </p>
    );
    if (!this.state.collapsed) {
      let searchedId = null;
      let searched = null;
      try {
        searched = localStorage.getItem("searched");
      } catch (ex) {
        console.warn("'localStorage.getItem(\"searched\")' didn't work");
      }
      if (searched) {
        if (searched.includes(",")) {
          // The new way
          searchedId = parseInt(searched.split(",")[0], 10);
        } else {
          // The old way!
          searchedId = parseInt(searched, 10);
        }
      }
      rest = (
        <div className="rest">
          <div className="text">
            <h3>Full Text</h3>
            {this.state.textHtml ? (
              <RenderParagraphs text={this.state.textHtml} />
            ) : (
              <i>Loading full text...</i>
            )}
            <SongComments
              comments={null}
              commentsCount={null}
              song={result}
              searchedId={searchedId}
            />
            <AmazonRelatedProducts song={result} />

            {/* {this.state.textHtml && (
              <YouTubeSnippetIntersectionLazy song={result} />
            )} */}
            <p className="load-more">
              <Link to={songURL}>GO TO SONG PAGE</Link>
            </p>
          </div>
        </div>
      );
    }

    let artistName = <b>{result.artist.name}</b>;
    if (result.artist.fragment) {
      artistName = (
        <b dangerouslySetInnerHTML={{ __html: result.artist.fragment }} />
      );
    }

    let tooltipTitle;
    if (process.env.NODE_ENV === "development") {
      let score = result.score.toFixed(4);
      tooltipTitle = `Score ${score}`;
      if (result.popularity) {
        tooltipTitle += ` Popularity: ${result.popularity.toFixed(6)}`;
      }
    } else {
      tooltipTitle = "Click to view just this song";
    }

    return (
      <div className={className}>
        <div className="head">
          <Link to={songURL}>{image}</Link>
          <h2 title={tooltipTitle}>
            <Link to={songURL}>{result.name}</Link>
            {showYear && result.year && (
              <span className="year"> {result.year}</span>
            )}
            {process.env.NODE_ENV === "development" ? (
              <ShowSongScore song={result} factor={popularityFactor} />
            ) : null}
          </h2>
          <h3>
            <span className="by">by</span> {artistName}
          </h3>

          {result.albums.length ? <Albums albums={result.albums} /> : null}
        </div>
        <div className="fragments">
          {result.fragments.map((fragment, i) => {
            return (
              <p
                key={`${result.id}${i}`}
                dangerouslySetInnerHTML={{ __html: fragment }}
              />
            );
          })}
        </div>
        {rest}
      </div>
    );
  }
}

const SongImage = React.memo(({ url, name, forceLoad, className }) => {
  // If the song doesn't haven an image, no point messing around.
  if (!url) {
    return (
      <img
        src={placeholderImage}
        className={className}
        title={name}
        alt={name}
      />
    );
  }
  return (
    <img
      src={url}
      className={className}
      title={name}
      alt={name}
      loading={forceLoad ? undefined : "lazy"}
    />
  );
});

// This assumes that we'll sooner or later need the lazyloadThumbnailImage image
if (!isServer) {
  new Image().src = lazyloadThumbnailImage;
}

// Module level "cache" of which image URLs have been successfully inserted
// into the DOM at least once.
// By knowing these, we can, on repeat URLs, avoid the whole lazy-load
// image swapping trick.
const loadedOnce = new Set();

function AutocompleteImage({ url, name }) {
  const [src, setSrc] = useState(
    loadedOnce.has(url) ? url : lazyloadThumbnailImage
  );

  useEffect(() => {
    let preloadImg = null;
    let dismounted = false;

    if (src === lazyloadThumbnailImage) {
      // We need to preload the eventually needed image.
      preloadImg = new Image();

      function cb() {
        if (!dismounted) {
          setSrc(url);
        }
        loadedOnce.add(url);
      }
      // This must come before .decode() otherwise Safari will
      // raise an EncodingError.
      preloadImg.src = url;
      // https://html.spec.whatwg.org/multipage/embedded-content.html#dom-img-decode
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode#Browser_compatibility
      preloadImg.decode
        ? preloadImg.decode().then(cb, cb)
        : (preloadImg.onload = cb);
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
      preloadImg.decoding = "sync";
    }

    return () => {
      if (preloadImg) {
        // Immediately undo the preloading since we might not need this image.
        // See https://jsfiddle.net/nw34gLgt/ for demo of this technique.
        preloadImg.src = "";
      }
      dismounted = true;
    };
  }, [url, src]);

  if (!url) {
    // Don't even bother with lazy loading.
    return (
      <img
        className="img-rounded"
        src={lazyloadThumbnailImage}
        alt={name}
        title={name}
      />
    );
  }

  return <img className="img-rounded" src={src} alt={name} title={name} />;
}

function ShowSongScore({ song, factor = 20 }) {
  const s = song.score - factor * song.popularity;
  return (
    <code>
      {song.score.toFixed(3)} = {s.toFixed(3)} + {factor}
      &times;
      {song.popularity.toFixed(4)}
    </code>
  );
}

const SongsByName = React.memo(({ results, total, limit, loadMoreByName }) => {
  return (
    <div className="by-name">
      <h4>Songs by name</h4>
      <ul>
        {results.map((s) => {
          return (
            <li key={s.id}>
              <Link to={s._url}>
                <b dangerouslySetInnerHTML={{ __html: s.fragment }} /> by{" "}
                <b>{s.artist.name}</b>
              </Link>
            </li>
          );
        })}
      </ul>
      {total > limit ? (
        <button className="btn btn-default btn-sm" onClick={loadMoreByName}>
          {total > 20
            ? "Show more songs by name"
            : `Show all (${total}) songs by name`}
        </button>
      ) : null}
    </div>
  );
});

const Albums = React.memo(({ albums }) => {
  return (
    <p className="albums">
      {albums.map((album, i) => {
        const parts = [<b key={album.id}>{album.name}</b>];
        if (album.year) {
          parts.push(` (${album.year})`);
        }
        if (i + 1 < albums.length) {
          parts.push(", ");
        }
        return parts;
      })}
    </p>
  );
});

const Pagination = React.memo(({ location, onLoadMore }) => {
  const currentURL = location.pathname + location.search;
  return (
    <div className="load-more">
      <a href={currentURL} onClick={onLoadMore}>
        LOAD MORE RESULTS
      </a>
    </div>
  );
});
