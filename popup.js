/**
 * MIT License
 *
 *    Copyright (c) 2016 June07
 *
 *    Permission is hereby granted, free of charge, to any person obtaining a copy
 *    of this software and associated documentation files (the "Software"), to deal
 *    in the Software without restriction, including without limitation the rights
 *    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *    copies of the Software, and to permit persons to whom the Software is
 *    furnished to do so, subject to the following conditions:
 *
 *    The above copyright notice and this permission notice shall be included in all
 *    copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *    SOFTWARE.
*/
var ngApp = angular.module('NimPopupApp', ['angularMoment', 'ngMaterial']);
ngApp
    .filter('stringLimit', ['$filter', function($filter) {
       return function(input, limit, ellipses) {
          if (! input) return;
          if (input.length <= limit && limit > 0) {
              return input;
          }
          var limitedString = $filter('limitTo')(input, Math.abs(limit));
          if (limit < 0)
            return input.substring(limitedString.lastIndexOf(" ")+1, input.length)
          if (! ellipses)
            return limitedString.substring(0, limitedString.lastIndexOf(" "))
          return limitedString + '...';
       };
    }])
    .controller('nimPopupController', ['$scope', '$window', function ($scope, $window) {
        $scope.sortType = 'date';
        $scope.sortReverse = true;
        $scope.active = "none";
        var bgWindow = $window.chrome.extension.getBackgroundPage();
        var controllerElement = bgWindow.document.querySelector('body');
        $scope.bg = bgWindow.angular.element(controllerElement).scope()
        $scope.bg.localize($window, function() {});
        $scope.yieldResult = "wait";
        $scope.messageModalState = "closed";
        $scope.tabs = [];
        $scope.selectedIndex = 0;
        var chrome = $window.chrome,
          $ = $window.$;

        $scope.getHost = function(newHost) {
          return arguments.length ? ($scope.bg.settings.host = newHost) : $scope.bg.settings.host;
        };

        function Tab(config) {
          var self = this;
          if (config === undefined) config = { title: 'localhost:9229' };
          self.id = uuid();
          self.order = config.order || null;
          self.title = config.title;
          self.session = config.session || null;
          self.disabled = config.disabled || false;
          self.auto = false;

          if (self.session && !self.title) {
            self.title = parseHostPortFromInfoURL(self.session.infoUrl);
          }
          function parseHostPortFromInfoURL(infoURL) {
            // 'http://' + $scope.settings.host + ':' + $scope.settings.port + '/json'
            return infoURL.split('http://')[1].split('/json')[0];
          }
          self.getHost = function() {
            return self.title.split(":")[0];
          }
          self.getPort = function() {
            return self.title.split(":")[1];
          }
          self.host = (function() {
            return self.title.split(":")[0];
          })();
          self.port = (function() {
            return self.title.split(":")[1];
          })();
          function uuid() {
            var uuid = "", i, random;
            for (i = 0; i < 32; i++) {
              random = Math.random() * 16 | 0;

              if (i == 8 || i == 12 || i == 16 || i == 20) {
                uuid += "-"
              }
              uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
            }
            return uuid;
          }
          return self;
        }
        
        function regenerateTabs() {
          $scope.tabs = [];
          $scope.bg.devToolsSessions.forEach(function(session) {
            addTab(new Tab({ session: session }));
          });
          $scope.bg.sessionlessTabs.forEach(function(sessionlessTab) {     
            addTab(sessionlessTab);
          });
          if ($scope.tabs.length === 0) {
            $scope.bg.sessionlessTabs.push(new Tab());
            regenerateTabs();
          }
        }
        $scope.$watch('bg.devToolsSessions', function() {
          regenerateTabs();
        });
        function addTab(tab) {
          tab.order = $scope.tabs.length;
          $scope.tabs.push(tab);
        }
        $scope.addTab = function() {
          incrementTarget($scope.bg.settings.autoIncrement.type, function(host, port) {
            $scope.bg.sessionlessTabs.push(new Tab({ title: host + ":" + port }));
            regenerateTabs();
          });
        }
        function incrementTarget(target, callback) {
          var newHost = $scope.bg.settings.host,
            newPort = $scope.bg.settings.port;
          switch (target) {
            case 'port':
              portCase(); break;
            case 'host':
              hostCase(); break;
            case 'both':
              hostCase();
              portCase(); break;
            default: break;
          }
          function hostCase() {
            var octets = $scope.bg.settings.host.split(".");
            for (var index = 1; index < 5; index++) {
              octets[octets.length-index] = parseInt(octets[octets.length-index]);
            }
            octets.every(function(octet, index, octets) {
              var endIndex = octets.length-1,
                done;
              if (octets[endIndex] <= 253) {
                octets[endIndex] = octets[endIndex] + 1; done = true;
              } else {
                octets[endIndex] = 1;
              }
              if ((index === octets.length-1) || done) {
                if (octets[0] === 0) newHost = "Pick a different subnet.  You seem to be out of addresses.";
                else newHost = octets[0] +"."+ octets[1] +"."+ octets[2] +"."+ octets[3];
                return;
              }
            });
          }
          function portCase() {
            newPort = parseInt($scope.bg.settings.port) + 1;
          }
          callback(newHost, newPort);
        }
        $scope.updateSessionUI = function() {
          $scope.bg.settings.host = $scope.tabs[$scope.selectedIndex].host;
          $scope.bg.settings.port = $scope.tabs[$scope.selectedIndex].port;
          $scope.bg.settings.auto = $scope.tabs[$scope.selectedIndex].auto;
        }
        $scope.$watch('bg.settings.host', function() {
          $scope.tabs[$scope.selectedIndex].title = ($scope.bg.settings.host ? $scope.bg.settings.host : '0.0.0.0') + ":" + ($scope.bg.settings.port ? $scope.bg.settings.port : '0');
          $scope.bg.saveSessionlessTabState($scope.tabs[$scope.selectedIndex]);
        });
        $scope.$watch('bg.settings.port', function() {
          $scope.tabs[$scope.selectedIndex].title = ($scope.bg.settings.host ? $scope.bg.settings.host : '0.0.0.0') + ":" + ($scope.bg.settings.port ? $scope.bg.settings.port : '0');
          $scope.bg.saveSessionlessTabState($scope.tabs[$scope.selectedIndex]);
        });
        $scope.$watch('bg.sessionlessTabs['+$scope.selectedIndex+'].auto', function() {
          $scope.bg.saveSessionlessTabState($scope.tabs[$scope.selectedIndex]);
        });
        
        $scope.removeTab = function (tabToRemove) {
          $scope.bg.sessionlessTabs.find(function(tab, index) {
            if (tab.id === tabToRemove.id) return $scope.bg.sessionlessTabs.splice(index, 1);
          })
          $scope.selectedIndex = Math.max(0, $scope.selectedIndex--);
          regenerateTabs();
        };
        $scope.openModal = function() {
          $.notify.close();
          $scope.pn.next("wait");
        }
        $scope.clickHandler = function () {
            // validate the host
            $scope.bg.save("host");
            $scope.bg.save("port");
            $scope.bg.openTab($scope.bg.settings.host, $scope.bg.settings.port, function (error, result) {
                if (error) showErrorMessage(error);
                else
                  $scope.message = result;
            });
        };
        $scope.addTabClickHandler = function() {
          $scope.addTab();
        }
        $scope.track = function (url) {
            $window._gaq.push(['_trackPageview', url]);
        };
        function showErrorMessage(error) {
          $window.document.querySelector('#site-href').style.display = "none";
          $window.Materialize.toast(error, 5000);
          var siteHrefTimeout;
          if (siteHrefTimeout) clearTimeout(siteHrefTimeout);
          siteHrefTimeout = setTimeout(function() {
            $window.document.querySelector('#site-href').style.display = "inline";
          }, 5050)
        }
        function trackInputClick(e) {
            $window._gaq.push(['_trackEvent', e.target.id, 'clicked']);
        }
        var userInputs = $window.document.getElementsByClassName('ga-track');

        function trackInputClickListener(event) {
            trackInputClick(event);
        }
        function keypressHandler(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                $scope.clickHandler();
                $window._gaq.push(['_trackEvent', 'User Event', 'OpenDevTools', 'Enter Key Pressed', '', true]);
            }
        }
        for (var i = 0; i < userInputs.length; i++) {
          userInputs[i].addEventListener('click', trackInputClickListener);
          if (userInputs[i].id === "port" || userInputs[i].id === "hostname")
            userInputs[i].addEventListener('keypress', keypressHandler);
        }
        $window.document.querySelector('#modal1 > div.modal-header > button').addEventListener('click', function() {
          $('#modal1').modal('close');
        });
        $window.document.querySelector('#modal2 > div.modal-header > button').addEventListener('click', function() {
          $('#modal2').modal('close');
        });
        $window.document.querySelector('#modal3 > div.modal-header > button').addEventListener('click', function() {
          $('#modal3').modal('close');
        });
        $window.document.querySelector('#options-button').addEventListener('click', function() {
          if (chrome.runtime.openOptionsPage) {
            // New way to open options pages, if supported (Chrome 42+).
            chrome.runtime.openOptionsPage();
          } else {
            // Reasonable fallback.
            $window.open(chrome.runtime.getURL('options.html'));
          }
        });
        $('.modal').modal({
          dismissible: true, // Modal can be dismissed by clicking outside of the modal
          opacity: .5, // Opacity of modal background
          in_duration: 300, // Transition in duration
          out_duration: 200, // Transition out duration
          starting_top: '4%', // Starting top style attribute
          ending_top: '10%' // Ending top style attribute
        });
        $window.document.querySelector('#options-button').addEventListener('click', function() {
          if (chrome.runtime.openOptionsPage) {
            // New way to open options pages, if supported (Chrome 42+).
            chrome.runtime.openOptionsPage();
          } else {
            // Reasonable fallback.
            $window.open(chrome.runtime.getURL('options.html'));
          }
        });
        $('.modal').modal({
          dismissible: true, // Modal can be dismissed by clicking outside of the modal
          opacity: .5, // Opacity of modal background
          in_duration: 300, // Transition in duration
          out_duration: 200, // Transition out duration
          starting_top: '4%', // Starting top style attribute
          ending_top: '10%', // Ending top style attribute
          ready: function() {
            $scope.messageModalState = "open";
            if ($scope.notify) $scope.notify.close();
          }
        });
        $('#modal1').perfectScrollbar();
        $('#modal2').perfectScrollbar();
    }]);