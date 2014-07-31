/**
 * Licensed to Neo Technology under one or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership. Neo Technology licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

'use strict';

function Gist($, $content) {

    var DROPBOX_PUBLIC_BASE_URL = 'https://dl.dropboxusercontent.com/u/';
    var DROPBOX_PRIVATE_BASE_URL = 'https://www.dropbox.com/s/';
    var DROPBOX_PRIVATE_API_BASE_URL = 'https://dl.dropboxusercontent.com/s/';
    var RISEUP_BASE_URL = 'https://pad.riseup.net/p/';
    var RISEUP_EXPORT_POSTFIX = '/export/txt';

    var VALID_GIST = /^[0-9a-f]{5,32}\/?$/;

    return {'getGistAndRenderPage': getGistAndRenderPage, 'readSourceId': readSourceId};

    function getGistAndRenderPage(renderer, defaultSource) {
        var id = window.location.search;
        if (id.length < 2) {
            id = defaultSource;
        }
        else {
            id = id.substr(1);
            var idCut = id.indexOf('&');
            if (idCut !== -1) {
                id = id.substring(0, idCut);
            }
            if (id.length > 20 && id.substring(0, 4) === '_ga=') {
                id = defaultSource;
            }
        }
        var fetcher = fetchGithubGist;
        if (id.indexOf('dropbox-') === 0) {
            fetcher = fetchPublicDropboxFile;
        }
        else if (id.indexOf('dropboxs-') === 0) {
            fetcher = fetchPrivateDropboxFile;
        }
        else if (id.indexOf('github-') === 0) {
            fetcher = fetchGithubFile;
        }
        else if(id.indexOf('riseup-') === 0) {
            fetcher = fetchRiseupFile;
        }
        else if (!VALID_GIST.test(id) && id.indexOf('%3A%2F%2F') !== -1) {
            fetcher = fetchAnyUrl;
        }
        fetcher(id, renderer, function (message) {
            errorMessage(message, id);
        });
    }

    function readSourceId(event) {
        var $target = $(event.target);
        if (event.which === 13 || event.which === 9) {
            event.preventDefault();
            $target.blur();
            var gist = $.trim($target.val());
            if (gist.indexOf('/') !== -1) {
                var dropboxPublicBaseLen = DROPBOX_PUBLIC_BASE_URL.length;
                var dropboxPrivateBaseLen = DROPBOX_PRIVATE_BASE_URL.length;
                if (gist.length > dropboxPublicBaseLen && gist.substr(0, dropboxPublicBaseLen) === DROPBOX_PUBLIC_BASE_URL) {
                    gist = 'dropbox-' + encodeURIComponent(gist.substr(dropboxPublicBaseLen));
                }
                else if (gist.length > dropboxPrivateBaseLen && gist.substr(0, dropboxPrivateBaseLen) === DROPBOX_PRIVATE_BASE_URL) {
                    gist = 'dropboxs-' + encodeURIComponent(gist.substr(dropboxPrivateBaseLen));
                }
                else if (gist.length > 30 && (gist.substr(0, 19) === 'https://github.com/' || gist.substr(0, 23) === 'https://raw.github.com/')
                    ) {
                    var parts = gist.split('/');
                    var isRaw = parts[2] === 'raw.github.com';
                    var pathIndex = isRaw ? 6 : 7;
                    var branchIndex = isRaw ? 5 : 6;
                    if (parts.length >= pathIndex) {
                        gist = 'github-' + parts[3] + '/' + parts[4];
                        if (parts[branchIndex] !== 'master') {
                            gist += '/' + parts[branchIndex];
                        }
                        gist += '//' + parts.slice(pathIndex).join('/');
                    } // else pretend it's a raw URL - encoding needed in both cases
                    gist = encodeURIComponent(gist);
                }
                else if (gist.length > RISEUP_BASE_URL.length && gist.indexOf(RISEUP_BASE_URL) === 0) {
                    gist = 'riseup-' + gist.split('/')[4];
                }
                else {
                    var pos = gist.lastIndexOf('/');
                    var endOfUrl = gist.substr(pos + 1);
                    if (gist.indexOf('://') !== -1 && !VALID_GIST.test(endOfUrl)) {
                        gist = encodeURIComponent(gist);
                    }
                    else {
                        gist = endOfUrl;
                    }
                }
            }
            if (gist.charAt(0) === '?') {
                // in case a GraphGist URL was pasted by mistake!
                gist = gist.substr(1);
            }
            window.location.assign('?' + gist);
        }
    }

    function fetchGithubGist(gist, success, error) {
        if (!VALID_GIST.test(gist)) {
            error('The gist id is malformed: ' + gist);
            return;
        }

        var url = 'https://api.github.com/gists/' + gist.replace("/", "");
        $.ajax({
            'url': url,
            'success': function (data) {
                var file = data.files[Object.keys(data.files)[0]];
                var content = file.content;
                var link = data.html_url;
                success(content, link);
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function fetchGithubFile(gist, success, error) {
        gist = gist.substr(7);
        var decoded = decodeURIComponent(gist);
        var parts = decoded.split('/');
        var branch = 'master';
        var pathPartsIndex = 3;
        if (decoded.indexOf('/contents/') !== -1) {
            window.location.assign('?github-' + encodeURIComponent(decoded.replace('/contents/', '//')));
            return;
        }
        if (parts.length >= 4 && parts[3] === '') {
            branch = parts[2];
            pathPartsIndex++;
        }
        var url = 'https://api.github.com/repos/' + parts[0] + '/' + parts[1] + '/contents/' + parts.slice(pathPartsIndex).join('/');
        $.ajax({
            'url': url,
            'data': {'ref': branch},
            'success': function (data) {
                var content = Base64.decode(data.content);
                var link = data.html_url;
                var imagesdir = 'https://raw.github.com/' + parts[0] + '/' + parts[1]
                    + '/' + branch + '/' + data.path.substring(0, -data.name.length);
                success(content, link, imagesdir);
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function fetchPublicDropboxFile(id, success, error) {
      id = id.substr(8);
      fetchDropboxFile(id, success, error, DROPBOX_PUBLIC_BASE_URL);
    }

    function fetchPrivateDropboxFile(id, success, error) {
      id = id.substr(9);
      fetchDropboxFile(id, success, error, DROPBOX_PRIVATE_API_BASE_URL);
    }

    function fetchDropboxFile(id, success, error, baseUrl) {
        fetchFromUrl(baseUrl + decodeURIComponent(id), success, error);
    }

    function fetchRiseupFile(id, success, error) {
      id = id.substr(7);
      var webUrl = RISEUP_BASE_URL + decodeURIComponent(id);
      fetchFromUrl(webUrl + RISEUP_EXPORT_POSTFIX, success, error, webUrl);
    }

    function fetchAnyUrl(id, success, error) {
        fetchFromUrl(decodeURIComponent(id), success, error);
    }

    function fetchFromUrl(url, success, error, sourceUrl) {
      $.ajax({
        'url': url,
        'success': function (data) {
          success(data, sourceUrl ? sourceUrl : url);
        },
        'dataType': 'text',
        'error': function (xhr, status, errorMessage) {
          error(errorMessage);
        }
      });
    }

    function errorMessage(message, gist) {
        var messageText;
        if (gist) {
            messageText = 'Something went wrong fetching the DocGist "' + gist + '":<p>' + message + '</p>';
        }
        else {
            messageText = '<p>' + message + '</p>';
        }

        $content.html('<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>');
    }
}
