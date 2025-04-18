/**
 * Cache Settings Component
 *
 * Displays cache statistics and allows configuration of cache settings.
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CacheManager, CacheInfo } from "../../lib/CacheManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trash2, RefreshCw as _RefreshCw } from "lucide-react";

export function CacheSettings() {
  const { t } = useTranslation();
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[]>([]);
  const [selectedCache, setSelectedCache] = useState<string>("");
  const [maxSize, setMaxSize] = useState<number>(100);
  const [timeToLive, setTimeToLive] = useState<number | undefined>(undefined);
  const [enableTTL, setEnableTTL] = useState<boolean>(false);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);

  // Get the cache manager instance
  const cacheManager = CacheManager.getInstance();

  // Load cache information
  useEffect(() => {
    const loadCacheInfo = () => {
      const info = cacheManager.getAllCacheInfo();
      setCacheInfo(info);

      if (info.length > 0 && !selectedCache) {
        setSelectedCache(info[0].name);
      }

      setMemoryUsage(cacheManager.getMemoryUsage());
    };

    loadCacheInfo();

    // Refresh cache info every 5 seconds
    const interval = setInterval(loadCacheInfo, 5000);
    return () => clearInterval(interval);
  }, [selectedCache]);

  // Load selected cache settings
  useEffect(() => {
    if (!selectedCache) return;

    // Find the cache ID from the name
    const cacheId = Array.from(cacheInfo).find(
      (c) => c.name === selectedCache
    )?.name;
    if (!cacheId) return;

    // Get the cache info
    const info = cacheManager.getCacheInfo(cacheId);
    if (!info) return;

    // Set the form values
    setMaxSize(info.capacity);
    setTimeToLive(info.timeToLive);
    setEnableTTL(info.timeToLive !== undefined);
  }, [selectedCache, cacheInfo]);

  // Handle saving cache settings
  const handleSaveSettings = () => {
    if (!selectedCache) return;

    // Find the cache ID from the name
    const cacheId = Array.from(cacheInfo).find(
      (c) => c.name === selectedCache
    )?.name;
    if (!cacheId) return;

    // Update the cache configuration
    cacheManager.updateCacheConfig(cacheId, {
      maxSize,
      timeToLive: enableTTL ? timeToLive : undefined,
      name: selectedCache,
    });

    // Refresh cache info
    setCacheInfo(cacheManager.getAllCacheInfo());
  };

  // Handle clearing a cache
  const handleClearCache = (cacheId: string) => {
    const cache = cacheManager.getCache(cacheId);
    if (cache) {
      cache.clear();
      setCacheInfo(cacheManager.getAllCacheInfo());
    }
  };

  // Handle clearing all caches
  const handleClearAllCaches = () => {
    cacheManager.clearAllCaches();
    setCacheInfo(cacheManager.getAllCacheInfo());
  };

  // Format bytes to a human-readable string
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format time to a human-readable string
  const formatTime = (ms?: number): string => {
    if (ms === undefined) return t("cache:noExpiration");

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} ${t("cache:seconds")}`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${t("cache:minutes")}`;

    const hours = Math.floor(minutes / 60);
    return `${hours} ${t("cache:hours")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t("cache:cacheSettings")}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("cache:totalMemoryUsage")}: {formatBytes(memoryUsage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAllCaches}
            title={t("cache:clearAllCaches")}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("cache:clearAll")}
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue={cacheInfo[0]?.name}
        value={selectedCache}
        onValueChange={setSelectedCache}
      >
        <TabsList className="grid grid-cols-4">
          {cacheInfo.map((cache) => (
            <TabsTrigger key={cache.name} value={cache.name}>
              {cache.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {cacheInfo.map((cache) => (
          <TabsContent
            key={cache.name}
            value={cache.name}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>{cache.name}</CardTitle>
                <CardDescription>{t("cache:cacheStatistics")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("cache:size")}</Label>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm">
                        {cache.size} / {cache.capacity}
                      </span>
                      <Progress
                        value={(cache.size / cache.capacity) * 100}
                        className="h-2 w-32"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>{t("cache:hitRate")}</Label>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm">
                        {(cache.hitRate * 100).toFixed(1)}%
                      </span>
                      <Progress
                        value={cache.hitRate * 100}
                        className="h-2 w-32"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>{t("cache:hits")}</Label>
                    <div className="text-sm mt-1">{cache.hits}</div>
                  </div>

                  <div>
                    <Label>{t("cache:misses")}</Label>
                    <div className="text-sm mt-1">{cache.misses}</div>
                  </div>

                  <div>
                    <Label>{t("cache:evictions")}</Label>
                    <div className="text-sm mt-1">{cache.evictions}</div>
                  </div>

                  <div>
                    <Label>{t("cache:timeToLive")}</Label>
                    <div className="text-sm mt-1">
                      {formatTime(cache.timeToLive)}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClearCache(cache.name)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("cache:clearCache")}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("cache:cacheConfiguration")}</CardTitle>
                <CardDescription>{t("cache:configureCache")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSize">{t("cache:maxSize")}</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="maxSize"
                      min={10}
                      max={1000}
                      step={10}
                      value={[maxSize]}
                      onValueChange={(value) => setMaxSize(value[0])}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={maxSize}
                      onChange={(e) =>
                        setMaxSize(parseInt(e.target.value) || 100)
                      }
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableTTL">
                      {t("cache:enableExpiration")}
                    </Label>
                    <Switch
                      id="enableTTL"
                      checked={enableTTL}
                      onCheckedChange={setEnableTTL}
                    />
                  </div>

                  {enableTTL && (
                    <div className="space-y-2 mt-2">
                      <Label htmlFor="timeToLive">
                        {t("cache:timeToLive")}
                      </Label>
                      <div className="grid grid-cols-3 gap-4">
                        <Button
                          variant={timeToLive === 60000 ? "default" : "outline"}
                          onClick={() => setTimeToLive(60000)}
                        >
                          1 {t("cache:minute")}
                        </Button>
                        <Button
                          variant={
                            timeToLive === 300000 ? "default" : "outline"
                          }
                          onClick={() => setTimeToLive(300000)}
                        >
                          5 {t("cache:minutes")}
                        </Button>
                        <Button
                          variant={
                            timeToLive === 1800000 ? "default" : "outline"
                          }
                          onClick={() => setTimeToLive(1800000)}
                        >
                          30 {t("cache:minutes")}
                        </Button>
                        <Button
                          variant={
                            timeToLive === 3600000 ? "default" : "outline"
                          }
                          onClick={() => setTimeToLive(3600000)}
                        >
                          1 {t("cache:hour")}
                        </Button>
                        <Button
                          variant={
                            timeToLive === 86400000 ? "default" : "outline"
                          }
                          onClick={() => setTimeToLive(86400000)}
                        >
                          1 {t("cache:day")}
                        </Button>
                        <Button
                          variant={
                            timeToLive === 604800000 ? "default" : "outline"
                          }
                          onClick={() => setTimeToLive(604800000)}
                        >
                          1 {t("cache:week")}
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        <Input
                          type="number"
                          value={
                            timeToLive !== undefined
                              ? Math.floor(timeToLive / 1000)
                              : 60
                          }
                          onChange={(e) =>
                            setTimeToLive(
                              parseInt(e.target.value) * 1000 || 60000
                            )
                          }
                          className="w-20"
                        />
                        <span className="text-sm">{t("cache:seconds")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveSettings}>
                  {t("cache:saveSettings")}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
